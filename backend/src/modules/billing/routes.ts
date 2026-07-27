import { Router } from 'express';
import { authRequired } from '../../middleware/auth.js';
import { entitlementsForUser } from '../../lib/entitlements.js';
import { stripeEnabled } from './stripe.js';
import { getPlans, isConfiguredPriceId } from './plans.js';
import { createCheckoutSession, createPortalSession } from './service.js';

/**
 * Billing API. The webhook lives in webhook.ts and is mounted separately (it
 * needs the raw body), so everything here can rely on the usual JSON parsing.
 *
 * Every route resolves the user from the verified token — a client can never
 * ask for someone else's checkout or portal session.
 */

const router = Router();

/**
 * Plan catalog. Public (the pricing page should render before sign-in) and the
 * amounts come from Stripe, never from code.
 */
router.get('/plans', async (_req, res) => {
  try {
    res.json({ configured: stripeEnabled(), plans: await getPlans() });
  } catch (err) {
    console.error('billing: failed to load plans:', (err as Error).message);
    res.status(502).json({ error: 'plans-unavailable', message: 'Could not load plans right now.' });
  }
});

router.use(authRequired);

/** The signed-in user's plan, derived server-side. */
router.get('/subscription', async (req, res) => {
  res.json({ subscription: await entitlementsForUser(req.user!.id) });
});

router.post('/checkout', async (req, res) => {
  if (!stripeEnabled()) {
    return res.status(503).json({ error: 'billing-not-configured', message: 'Payments are not enabled yet.' });
  }

  const { priceId } = (req.body || {}) as { priceId?: unknown };
  if (typeof priceId !== 'string' || !priceId) {
    return res.status(400).json({ error: 'invalid-request', message: 'priceId is required.' });
  }
  // Only prices this deployment configured — stops a client from checking out
  // against an arbitrary (e.g. $0) price id.
  if (!isConfiguredPriceId(priceId)) {
    return res.status(400).json({ error: 'unknown-price', message: 'That plan is not available.' });
  }

  // Already subscribed → the portal is the right place to switch plans, and it
  // avoids creating a second subscription for the same customer.
  const current = await entitlementsForUser(req.user!.id);
  if (current.active) {
    return res.status(409).json({
      error: 'already-subscribed',
      message: 'You already have an active plan. Use Manage Plan to make changes.',
    });
  }

  try {
    const url = await createCheckoutSession({ userId: req.user!.id, email: req.user!.email, priceId });
    res.json({ url });
  } catch (err) {
    console.error('billing: checkout session failed:', (err as Error).message);
    res.status(502).json({ error: 'checkout-failed', message: 'Could not start checkout. Please try again.' });
  }
});

router.post('/portal', async (req, res) => {
  if (!stripeEnabled()) {
    return res.status(503).json({ error: 'billing-not-configured', message: 'Payments are not enabled yet.' });
  }
  try {
    const url = await createPortalSession(req.user!.id, req.user!.email);
    res.json({ url });
  } catch (err) {
    console.error('billing: portal session failed:', (err as Error).message);
    res.status(502).json({ error: 'portal-failed', message: 'Could not open the billing portal. Please try again.' });
  }
});

export default router;
