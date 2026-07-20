import crypto from 'node:crypto';
import { prisma } from '../../db.js';

/**
 * Opaque token machinery. Raw tokens are 256-bit random strings handed to the
 * client once; only their sha256 lands in the database, so a DB leak exposes
 * no usable credentials.
 *
 * - Refresh tokens rotate: each use marks the row rotated and issues a new
 *   token. A rotated token presented AGAIN means it leaked (or two devices
 *   race) — we revoke the user's every session, forcing a clean re-login.
 * - Action tokens (verify-email / reset-password) are single-use with short
 *   expiries; issuing a new one invalidates unused predecessors of that type.
 */

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACTION_TTL_MS: Record<ActionTokenType, number> = {
  'verify-email': 24 * 60 * 60 * 1000, // 24h
  'reset-password': 60 * 60 * 1000, // 1h
};

export type ActionTokenType = 'verify-email' | 'reset-password';

function newRawToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hash(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = newRawToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return raw;
}

/** Rotates on success: returns the userId plus a fresh refresh token, or null. */
export async function consumeRefreshToken(raw: string): Promise<{ userId: string; newToken: string } | null> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row) return null;
  if (row.rotatedAt) {
    // Reuse of a rotated token — treat the whole session family as compromised.
    await revokeAllRefreshTokens(row.userId);
    return null;
  }
  if (row.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({ where: { id: row.id }, data: { rotatedAt: new Date() } });
  const newToken = await issueRefreshToken(row.userId);
  return { userId: row.userId, newToken };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hash(raw) } });
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function issueActionToken(userId: string, type: ActionTokenType): Promise<string> {
  // A new request supersedes any unused token of the same type.
  await prisma.actionToken.deleteMany({ where: { userId, type, usedAt: null } });
  const raw = newRawToken();
  await prisma.actionToken.create({
    data: { userId, type, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ACTION_TTL_MS[type]) },
  });
  return raw;
}

export async function consumeActionToken(raw: string, type: ActionTokenType): Promise<string | null> {
  const row = await prisma.actionToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.actionToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
