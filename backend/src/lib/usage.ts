import { prisma } from '../db.js';
import { entitlementsForUser, type Entitlements, type Limits } from './entitlements.js';

/**
 * Free-tier usage accounting.
 *
 * Usage is DERIVED from the meetings table, not tracked in a counter column.
 * A counter is a second source of truth that drifts the first time a save is
 * retried, a meeting is deleted, or a webhook lands twice — and reconciling it
 * costs more than the aggregate query saves at this scale. The meetings rows
 * are the record of what happened; this just reads them.
 *
 * The period is the calendar month in UTC. Users are in PH (UTC+8), so a call
 * at 07:00 Manila on the 1st counts against the previous month. That is a
 * deliberate simplification for the prototype and is called out in
 * docs/ACCOUNT_TIERS.md; switching to Asia/Manila boundaries is a change to
 * `periodStart` alone.
 */

export interface Usage {
  callsUsed: number;
  minutesUsed: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageStatus {
  entitlements: Entitlements;
  usage: Usage;
  limits: Limits;
  /** Remaining allowance; null where the limit is unlimited. */
  callsRemaining: number | null;
  minutesRemaining: number | null;
  /** True when a new call may be started right now. */
  canStartCall: boolean;
  /** Set when canStartCall is false, so the UI can say which limit bit. */
  blockedBy: 'calls' | 'minutes' | null;
}

export function periodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function periodEnd(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function usageForUser(userId: string, now = new Date()): Promise<Usage> {
  const start = periodStart(now);
  const end = periodEnd(now);

  const agg = await prisma.meeting.aggregate({
    where: { userId, startedAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { durationSeconds: true },
  });

  return {
    callsUsed: agg._count._all,
    // Round up: a 30-second call has consumed a minute of a 30-minute
    // allowance as far as the user is concerned, and rounding down would let
    // an unlimited number of very short calls through the minutes cap.
    minutesUsed: Math.ceil((agg._sum.durationSeconds ?? 0) / 60),
    periodStart: start,
    periodEnd: end,
  };
}

export async function usageStatusForUser(userId: string, now = new Date()): Promise<UsageStatus> {
  const [entitlements, usage] = await Promise.all([
    entitlementsForUser(userId),
    usageForUser(userId, now),
  ]);
  const limits = entitlements.limits;

  const callsRemaining =
    limits.callsPerMonth === null ? null : Math.max(0, limits.callsPerMonth - usage.callsUsed);
  const minutesRemaining =
    limits.minutesPerMonth === null ? null : Math.max(0, limits.minutesPerMonth - usage.minutesUsed);

  let blockedBy: 'calls' | 'minutes' | null = null;
  if (callsRemaining !== null && callsRemaining <= 0) blockedBy = 'calls';
  else if (minutesRemaining !== null && minutesRemaining <= 0) blockedBy = 'minutes';

  return {
    entitlements,
    usage,
    limits,
    callsRemaining,
    minutesRemaining,
    canStartCall: blockedBy === null,
    blockedBy,
  };
}

/**
 * Human copy for a spent allowance. Kept server-side so the limit numbers are
 * stated in exactly one place — the client renders whatever it is handed.
 */
export function limitMessage(status: UsageStatus): string {
  if (status.blockedBy === 'calls') {
    return `You've used all ${status.limits.callsPerMonth} free calls this month. Upgrade to Pro for unlimited calls, or wait until your allowance resets.`;
  }
  if (status.blockedBy === 'minutes') {
    return `You've used your ${status.limits.minutesPerMonth} free call minutes this month. Upgrade to Pro for unlimited minutes, or wait until your allowance resets.`;
  }
  return '';
}
