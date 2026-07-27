import { Router, raw } from 'express';
import type Stripe from 'stripe';
import { config } from '../../config.js';
import { getStripe, webhooksConfigured } from './stripe.js';
import { syncSubscription, markSubscriptionCanceled } from './service.js';

/**
 * Stripe webhook receiver.
 *
 * MOUNTING IS LOAD-BEARING: this router must be mounted in server.ts BEFORE
 * `express.json()`, because signature verification hashes the exact raw bytes
 * Stripe sent. A parsed-then-restringified body will not match. It is also
 * mounted above the rate limiter so Stripe's retry bursts are never throttled.
 *
 * Delivery guarantees we design around: at-least-once, and NOT ordered. So no
 * handler trusts the event payload's contents — each one re-retrieves the
 * subscription from Stripe and writes current truth (see service.syncSubscription).
 * That makes replays and out-of-order arrivals harmless.
 */

const router = Router();

router.post('/', raw({ type: 'application/json' }), async (req, res) => {
  if (!webhooksConfigured()) {
    // Nothing to verify against — refuse rather than trust an unsigned payload.
    return res.status(503).json({ error: 'billing-not-configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).json({ error: 'missing-signature' });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, config.stripeWebhookSecret);
  } catch (err) {
    // Bad signature = not from Stripe (or the wrong webhook secret).
    console.error('billing: webhook signature verification failed:', (err as Error).message);
    return res.status(400).json({ error: 'invalid-signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Subscription checkouts always carry a subscription id here.
        if (session.subscription) {
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          await syncSubscription(id);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end':
        await syncSubscription((event.data.object as Stripe.Subscription).id);
        break;

      case 'customer.subscription.deleted':
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      // Renewals and failures both just re-sync: the subscription's own status
      // ('active' vs 'past_due') is the thing we actually care about.
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
        if (subRef) await syncSubscription(typeof subRef === 'string' ? subRef : subRef.id);
        break;
      }

      default:
        // Unhandled types are acknowledged so Stripe stops retrying them.
        break;
    }

    res.json({ received: true });
  } catch (err) {
    // 500 tells Stripe to retry with backoff — correct for transient DB/API
    // failures, and safe because every handler above is idempotent.
    console.error(`billing: error handling ${event.type}:`, (err as Error).message);
    res.status(500).json({ error: 'webhook-handler-failed' });
  }
});

export default router;
