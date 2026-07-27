import { config } from '../../config.js';
import { getStripe, stripeEnabled } from './stripe.js';

/**
 * The plan catalog.
 *
 * PRICING IS NOT DEFINED HERE. Only Price *IDs* are configured (env); the
 * amount, currency and interval are read from Stripe at request time and
 * returned to the client for display. Consequences:
 *
 *  - Final pricing is decided in the Stripe dashboard; no code change, no deploy.
 *  - The UI can never drift from what the customer is actually charged.
 *  - PH pricing later = a PHP price on the same product (or Stripe's
 *    multi-currency), still with zero code change here.
 *
 * Adding a tier = add a price-id config var + one entry in TIERS.
 */

export interface PlanPrice {
  priceId: string;
  /** Minor units as Stripe reports them (e.g. 29900 = ₱299.00). */
  amount: number | null;
  currency: string | null;
  interval: string | null;
  /** Preformatted for display, e.g. "₱299.00". Built from Stripe's own values. */
  display: string | null;
}

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  /** Feature bullets are product copy, deliberately generic until tiers are finalized. */
  features: string[];
  /** Absent for the free tier; populated only for configured price ids. */
  prices: PlanPrice[];
  /** True when this tier can actually be purchased right now. */
  purchasable: boolean;
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Get started with AI communication coaching.',
    features: ['Live call coaching', 'Post-call AI review', 'Practice sessions', 'Progress tracking'],
    priceIds: [] as string[],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For virtual assistants who want to level up faster.',
    features: [
      'Everything in Free',
      'Higher usage limits',
      'Deeper AI analysis',
      'Full call history & replay',
      'Priority support',
    ],
    // Order matters: monthly first, then yearly. Unset ids are filtered out.
    priceIds: [config.stripePriceProMonthly, config.stripePriceProYearly].filter(Boolean),
  },
];

/** Money formatting driven entirely by what Stripe reports for the price. */
function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount === null || !currency) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      // Stripe reports minor units for most currencies; zero-decimal ones
      // (JPY, KRW…) report whole units, and Intl already knows which is which.
      minimumFractionDigits: undefined,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// Prices change rarely; a short cache keeps the plans endpoint snappy without
// letting a dashboard edit go unnoticed for long.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; tiers: PlanTier[] } | null = null;

async function resolvePrice(priceId: string): Promise<PlanPrice> {
  try {
    const price = await getStripe().prices.retrieve(priceId);
    const amount = price.unit_amount ?? null;
    const currency = price.currency ?? null;
    return {
      priceId,
      amount,
      currency,
      interval: price.recurring?.interval ?? null,
      display: formatAmount(amount, currency),
    };
  } catch (err) {
    // A bad/typo'd price id must not break the whole pricing page — the tier
    // simply renders without that option, and the reason is logged.
    console.error(`billing: could not resolve price ${priceId}:`, (err as Error).message);
    return { priceId, amount: null, currency: null, interval: null, display: null };
  }
}

export async function getPlans(): Promise<PlanTier[]> {
  if (!stripeEnabled()) {
    // Billing not configured: advertise the tiers, mark nothing purchasable.
    // Fields are listed explicitly (not spread) so internal config like
    // `priceIds` never leaks and the shape matches the configured branch.
    return TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      features: t.features,
      prices: [],
      purchasable: false,
    }));
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.tiers;

  const tiers: PlanTier[] = await Promise.all(
    TIERS.map(async (t) => {
      const prices = (await Promise.all(t.priceIds.map(resolvePrice))).filter((p) => p.amount !== null);
      return {
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        features: t.features,
        prices,
        purchasable: prices.length > 0,
      };
    })
  );

  cache = { at: Date.now(), tiers };
  return tiers;
}

/** Guards checkout: only price ids this deployment actually configured. */
export function isConfiguredPriceId(priceId: string): boolean {
  return TIERS.some((t) => t.priceIds.includes(priceId));
}

/** Test hook / dashboard-edit escape hatch. */
export function clearPlanCache(): void {
  cache = null;
}
