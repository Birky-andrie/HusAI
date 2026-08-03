import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

/**
 * The ONE place that decides what a user is allowed to do.
 *
 * Nothing else in the app compares `subscription.status` to a string literal or
 * hardcodes a limit — change the mapping or the numbers here and every gate
 * follows.
 *
 * Precedence, highest first:
 *   1. `user.planOverride` — the manual prototype lever (see PLAN_OVERRIDES).
 *   2. The Stripe subscription status.
 *   3. Free.
 *
 * The override winning over billing is intentional: during the prototype we
 * grant access by hand, and a support grant must not be silently undone the
 * next time a Stripe webhook lands.
 */

export type Plan = 'free' | 'trial' | 'pro';

/** Valid values for `User.planOverride`. Anything else is ignored as if null. */
const PLAN_OVERRIDES = new Set(['unlimited', 'pro', 'free']);

export interface Limits {
  /** Calls per calendar month. `null` = unlimited. */
  callsPerMonth: number | null;
  /** Total call minutes per calendar month. `null` = unlimited. */
  minutesPerMonth: number | null;
}

export const FREE_LIMITS: Limits = {
  callsPerMonth: 3,
  minutesPerMonth: 30,
};

export const UNLIMITED: Limits = {
  callsPerMonth: null,
  minutesPerMonth: null,
};

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
  /** What this user may spend this month. */
  limits: Limits;
  /** Set when a manual override is what granted this plan, for UI + support. */
  overrideReason: string | null;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  status: 'free',
  active: false,
  pastDue: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  limits: FREE_LIMITS,
  overrideReason: null,
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

type OverrideRow = {
  planOverride: string | null;
  planOverrideNote: string | null;
};

export function resolveEntitlements(
  sub: SubscriptionRow | null | undefined,
  user?: OverrideRow | null
): Entitlements {
  const override = user?.planOverride;

  if (override && PLAN_OVERRIDES.has(override)) {
    if (override === 'free') {
      return { ...FREE_ENTITLEMENTS, overrideReason: user?.planOverrideNote ?? 'manually set to free' };
    }
    // 'unlimited' and 'pro' both mean full access with no quota. They are kept
    // as separate words only so the DB says why: 'unlimited' reads as a grant,
    // 'pro' reads as "treat exactly like a paying customer".
    return {
      plan: 'pro',
      status: override,
      active: true,
      pastDue: false,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      limits: UNLIMITED,
      overrideReason: user?.planOverrideNote ?? `granted (${override})`,
    };
  }

  if (!sub) return FREE_ENTITLEMENTS;

  const status = sub.status || 'free';
  const trialing = status === 'trialing';
  const paid = PAID_STATUSES.has(status);
  const active = trialing || paid;

  return {
    plan: trialing ? 'trial' : paid ? 'pro' : 'free',
    status,
    active,
    pastDue: GRACE_STATUSES.has(status),
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    limits: active ? UNLIMITED : FREE_LIMITS,
    overrideReason: null,
  };
}

/** Server-side truth for a user's plan. Never trust the client for this. */
export async function entitlementsForUser(userId: string): Promise<Entitlements> {
  const [sub, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { planOverride: true, planOverrideNote: true },
    }),
  ]);
  return resolveEntitlements(sub, user);
}

/**
 * Gate a route behind an active paid/trial plan.
 *
 *   router.post('/some-pro-feature', authRequired, requireActivePlan, handler)
 *
 * Responds 402 with a machine-readable `error: 'upgrade-required'` and the
 * feature name, which is what the client turns into the upgrade overlay.
 */
export function requireActivePlan(feature = 'This feature') {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const ent = await entitlementsForUser(req.user!.id);
    if (!ent.active) {
      res.status(402).json({
        error: 'upgrade-required',
        message: `${feature} is part of HusAI Pro.`,
        feature,
        plan: ent.plan,
      });
      return;
    }
    next();
  };
}
