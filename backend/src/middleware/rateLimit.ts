import rateLimit from 'express-rate-limit';

/**
 * Rate limiting (per client IP). The backend runs behind Render's proxy, so
 * `app.set('trust proxy', 1)` in server.ts is required for req.ip to reflect the
 * real client rather than the proxy — otherwise every request would share one
 * bucket. Store is in-memory (fine for the single Render instance); move to a
 * shared store (e.g. Redis) if the backend is ever scaled horizontally.
 */

const rl = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true, // RateLimit-* headers so clients can back off
    legacyHeaders: false,
    message: { error: 'rate-limited', message },
  });

// Broad flood protection across the whole API (per IP). Generous enough for
// heavy legitimate use (a long call plus dashboard browsing), blocks scripted
// abuse. Excludes /api/health (mounted before this).
export const apiLimiter = rl(
  15 * 60 * 1000,
  1000,
  'Too many requests — please slow down and try again in a few minutes.'
);

// Tighter cap on the expensive, unauthenticated AI endpoints
// (lifeline / transcribe / review). A single active call makes ~10–15 of these
// per minute, so 100/min leaves ample headroom while stopping brute abuse. The
// daily org-wide cost ceiling is still enforced separately by quotaGuard.
export const aiLimiter = rl(
  60 * 1000,
  100,
  'Too many requests — please slow down.'
);
