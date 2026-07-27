import Stripe from 'stripe';
import { config } from '../../config.js';

/**
 * Stripe client, created lazily so the app boots and runs normally with no
 * billing keys configured (local dev, or before go-live). Every caller must
 * check `stripeEnabled()` first — `getStripe()` throws rather than returning a
 * half-configured client that would fail deep inside a request.
 */

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(config.stripeSecretKey);
}

export function getStripe(): Stripe {
  if (!config.stripeSecretKey) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY is unset)');
  }
  if (!client) {
    // No apiVersion pin: the SDK's default matches the version it ships with,
    // which keeps types and runtime in agreement across upgrades.
    client = new Stripe(config.stripeSecretKey);
  }
  return client;
}

/** True once webhook signature verification is possible. */
export function webhooksConfigured(): boolean {
  return Boolean(config.stripeSecretKey && config.stripeWebhookSecret);
}
