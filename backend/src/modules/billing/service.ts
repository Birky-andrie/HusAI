import type Stripe from 'stripe';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { getStripe } from './stripe.js';

/**
 * Billing operations against the provider. The `Subscription` row is only ever a
 * cache of provider state — `syncSubscription` is the single writer, and it
 * always writes from a freshly retrieved provider object rather than from a
 * webhook payload, which makes it idempotent and safe under out-of-order events.
 */

/** HashRouter: in-app links must live after the '#'. */
function appUrl(path: string): string {
  return `${config.frontendUrl.replace(/\/$/, '')}/#${path}`;
}

/** Stripe timestamps are seconds; Prisma wants Date. */
const toDate = (secs: number | null | undefined): Date | null =>
  typeof secs === 'number' ? new Date(secs * 1000) : null;

/**
 * The user's Stripe customer id, creating the customer on first use. Stored on
 * the Subscription row so it survives cancellation — re-subscribing later
 * reuses the same customer (and keeps their payment methods and invoices).
 */
export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing?.customerId) return existing.customerId;

  const customer = await getStripe().customers.create({
    email,
    // Lets us recover the app user from any Stripe object, including events
    // that arrive without our own metadata.
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    update: { customerId: customer.id },
    create: { userId, customerId: customer.id, provider: 'stripe', status: 'free' },
  });

  return customer.id;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
  priceId: string;
}): Promise<string> {
  const customerId = await getOrCreateCustomer(opts.userId, opts.email);

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    // Both are belt-and-braces for attributing the subscription back to a user.
    client_reference_id: opts.userId,
    subscription_data: {
      metadata: { userId: opts.userId },
      ...(config.stripeTrialDays > 0 ? { trial_period_days: config.stripeTrialDays } : {}),
    },
    success_url: appUrl('/settings?checkout=success'),
    cancel_url: appUrl('/plans?checkout=cancelled'),
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL');
  return session.url;
}

export async function createPortalSession(userId: string, email: string): Promise<string> {
  const customerId = await getOrCreateCustomer(userId, email);
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: appUrl('/settings'),
  });
  return session.url;
}

/**
 * Write provider state into our cache. Accepts either a subscription object or
 * an id (which is re-retrieved) — webhook handlers pass the id so the write is
 * always based on current truth, not on a possibly-stale event payload.
 */
export async function syncSubscription(subOrId: Stripe.Subscription | string): Promise<void> {
  const sub = typeof subOrId === 'string' ? await getStripe().subscriptions.retrieve(subOrId) : subOrId;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Prefer our own metadata; fall back to the customerId we already stored.
  const userId =
    sub.metadata?.userId ||
    (await prisma.subscription.findFirst({ where: { customerId }, select: { userId: true } }))?.userId;

  if (!userId) {
    console.error(`billing: no app user for subscription ${sub.id} (customer ${customerId}) — ignoring`);
    return;
  }

  const item = sub.items.data[0];
  // The SDK's Subscription type doesn't surface period fields uniformly across
  // versions; they're present on the item in current API versions.
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end;

  const data = {
    provider: 'stripe',
    customerId,
    subscriptionId: sub.id,
    status: sub.status,
    priceId: item?.price?.id ?? null,
    interval: item?.price?.recurring?.interval ?? null,
    currentPeriodEnd: toDate(periodEnd),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    trialEndsAt: toDate(sub.trial_end),
  };

  await prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

/**
 * Mark a subscription ended. Keeps customerId so the user can re-subscribe
 * without creating a duplicate Stripe customer.
 */
export async function markSubscriptionCanceled(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const existing = await prisma.subscription.findFirst({
    where: { OR: [{ subscriptionId: sub.id }, { customerId }] },
  });
  if (!existing) return;

  await prisma.subscription.update({
    where: { userId: existing.userId },
    data: {
      status: sub.status, // 'canceled' | 'incomplete_expired'
      subscriptionId: null, // free the unique slot for a future subscription
      priceId: null,
      interval: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEndsAt: null,
    },
  });
}

/**
 * Best-effort cancellation when an account is deleted, so we never keep billing
 * someone who no longer has an account. Failures are logged, never thrown — the
 * account deletion itself must still succeed.
 */
export async function cancelSubscriptionForUser(userId: string): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.subscriptionId) return;
    await getStripe().subscriptions.cancel(sub.subscriptionId);
  } catch (err) {
    console.error(`billing: failed to cancel subscription for deleted user ${userId}:`, (err as Error).message);
  }
}
