/**
 * Presentation helpers for the subscription object returned by GET /api/me
 * (shape produced by backend `resolveEntitlements`):
 *   { plan: 'free'|'trial'|'pro', status, active, pastDue,
 *     currentPeriodEnd, cancelAtPeriodEnd, trialEndsAt }
 *
 * These are for DISPLAY ONLY. Access decisions are made server-side — a
 * tampered client can change what it renders, never what it is allowed to do.
 */

const LABELS = { free: 'Free Plan', trial: 'Pro Trial', pro: 'Pro Plan' };

export function planLabel(subscription) {
  return LABELS[subscription?.plan] || LABELS.free;
}

export function isPro(subscription) {
  return Boolean(subscription?.active);
}

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

/** One honest sentence about where the subscription stands right now. */
export function statusNote(subscription) {
  if (!subscription || subscription.plan === 'free') return 'You are on the free plan.';

  if (subscription.pastDue) {
    return 'We could not process your last payment. Update your payment method to keep Pro access.';
  }
  if (subscription.cancelAtPeriodEnd) {
    const end = fmtDate(subscription.currentPeriodEnd);
    return end ? `Your plan is set to cancel on ${end}.` : 'Your plan is set to cancel at the end of this period.';
  }
  if (subscription.plan === 'trial') {
    const end = fmtDate(subscription.trialEndsAt);
    return end ? `Your free trial runs until ${end}.` : 'You are on a free trial.';
  }
  const end = fmtDate(subscription.currentPeriodEnd);
  return end ? `Your plan renews on ${end}.` : 'Your plan is active.';
}

/** Interval suffix for a price, e.g. "/month". */
export function intervalLabel(interval) {
  if (interval === 'month') return '/month';
  if (interval === 'year') return '/year';
  return '';
}
