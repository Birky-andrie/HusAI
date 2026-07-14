import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response, NextFunction } from 'express';

export type QuotaProvider = 'groqChat' | 'groqWhisper' | 'gemini';

// Free-tier limits are per ORG, not per user — 50 alpha users share these.
// Caps leave ~10% headroom so we never let the provider itself return a 429.
const CAPS: Record<QuotaProvider, number> = {
  groqChat: Number(process.env.GROQ_DAILY_CAP || 12960), // llama-3.1-8b-instant: 14,400/day
  groqWhisper: Number(process.env.GROQ_WHISPER_DAILY_CAP || 1800), // whisper-large-v3-turbo: 2,000/day
  gemini: Number(process.env.GEMINI_DAILY_CAP || 225), // gemini-3.5-flash: ~250/day (unpublished)
};

const LOG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'api-calls.log');

interface LogEntry {
  provider: QuotaProvider;
  endpoint?: string;
  platform?: string;
  ok?: boolean;
  reason?: string;
  error?: string;
  [key: string]: unknown;
}

let counters = freshCounters();
const recentCalls: Array<LogEntry & { ts: string }> = []; // in-memory tail for quick inspection

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function freshCounters() {
  return { day: today(), groqChat: 0, groqWhisper: 0, gemini: 0 };
}

function rolloverIfNewDay(): void {
  if (counters.day !== today()) counters = freshCounters();
}

export function logCall(entry: LogEntry): void {
  const record = { ts: new Date().toISOString(), ...entry };
  recentCalls.push(record);
  if (recentCalls.length > 1000) recentCalls.shift();
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('Failed to write api-calls.log:', (err as Error).message);
  }
}

/**
 * Express middleware factory. Rejects with a graceful 503 BEFORE the request
 * reaches the provider when today's cap for that provider is exhausted.
 */
export function quotaGuard(provider: QuotaProvider) {
  if (!(provider in CAPS)) throw new Error(`Unknown quota provider: ${provider}`);
  return (req: Request, res: Response, next: NextFunction) => {
    rolloverIfNewDay();
    if (counters[provider] >= CAPS[provider]) {
      logCall({
        provider,
        endpoint: req.baseUrl,
        platform: (req.body as { platform?: string } | undefined)?.platform || 'unknown',
        ok: false,
        reason: 'quota-cap',
      });
      res.status(503).json({
        error: 'capacity',
        message: 'This feature is temporarily at capacity. Please try again later.',
      });
      return;
    }
    next();
  };
}

/** Call after every real provider request (success or failure) to count it and log it. */
export function recordCall(provider: QuotaProvider, meta: Omit<LogEntry, 'provider'> = {}): void {
  rolloverIfNewDay();
  counters[provider] += 1;
  logCall({ provider, ...meta });
}

export function quotaStatus() {
  rolloverIfNewDay();
  return {
    groqChat: Math.max(0, CAPS.groqChat - counters.groqChat),
    groqWhisper: Math.max(0, CAPS.groqWhisper - counters.groqWhisper),
    gemini: Math.max(0, CAPS.gemini - counters.gemini),
  };
}
