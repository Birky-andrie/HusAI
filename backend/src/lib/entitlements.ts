import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

/**
 * The ONE place that interprets a payment provider's raw subscription status.
 * Nothing else in the app compares `subscription.status` to a string literal —
 * change the mapping here and every gate follows.
 *
 * Plans are intentionally coarse ('free' | 'trial' | 'pro'). What each plan
 * *includes* is still being finalized, so FEATURES below is the seam for that
 * decision, not a promise about it.
 */

export type Plan = 'free' | 'trial' | 'pro';

export interface Entitlements {
  plan: Plan;
  /** Raw provider status, surfaced for UI copy ("payment failed", etc.). */
  status: string;
  /** True while the user should get paid features — includes grace periods. */
  active: boolean;
  /** True when payment is failing but access is retained during the retry window. */
  pastDue: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  status: 'free',
  active: false,
  pastDue: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
};

// Stripe subscription statuses that mean "this person is paying us".
// `past_due`/`unpaid` keep access on purpose: Stripe retries failed payments for
// days, and locking someone out mid-retry over an expired card is a good way to
// lose a customer who intended to pay. The UI warns them instead.
const PAID_STATUSES = new Set(['active', 'past_due', 'unpaid']);
const GRACE_STATUSES = new Set(['past_due', 'unpaid']);

type SubscriptionRow = {
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
};

export function resolveEntitlements(sub: SubscriptionRow | null | undefined): Entitlements {
  if (!sub) return FREE_ENTITLEMENTS;

  const status = sub.status || 'free';
  const trialing = status === 'trialing';
  const paid = PAID_STATUSES.has(status);

  return {
    plan: trialing ? 'trial' : paid ? 'pro' : 'free',
    status,
    active: trialing || paid,
    pastDue: GRACE_STATUSES.has(status),
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
  };
}

/** Server-side truth for a user's plan. Never trust the client for this. */
export async function entitlementsForUser(userId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return resolveEntitlements(sub);
}

/**
 * Gate a route behind an active paid/trial subscription.
 *
 * DELIBERATELY UNUSED TODAY. Plan contents are not finalized, so no existing
 * feature is locked — wiring this onto a route now would be guessing at the
 * product. When tiers are decided, add it after `authRequired`:
 *
 *   router.post('/some-pro-feature', authRequired, requireActivePlan, handler)
 *
 * It is exported (and typechecked) so turning a feature Pro-only is a one-line
 * change rather than a new subsystem.
 */
export async function requireActivePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ent = await entitlementsForUser(req.user!.id);
  if (!ent.active) {
    res.status(402).json({
      error: 'upgrade-required',
      message: 'This feature is part of HusAI Pro.',
      plan: ent.plan,
    });
    return;
  }
  next();
}
