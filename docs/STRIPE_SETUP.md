# Getting Stripe payments working

**Current status: the code is complete and correct. Nothing is configured, so
payments are switched off.**

All four Stripe variables in `backend/.env` are empty, which makes
`stripeEnabled()` false. The app runs normally in that state by design — the
pricing page renders, nothing is purchasable, and no route 500s.

---

## What was checked, and what it found

| Area | Status |
|---|---|
| Checkout session creation | ✅ Correct — customer reused, `userId` in metadata |
| Webhook signature verification | ✅ Correct |
| Webhook mounted before `express.json()` | ✅ Correct — verified in `server.ts:30` vs `:33` |
| Webhook above the rate limiter | ✅ Correct — Stripe retry bursts won't be throttled |
| Idempotent event handling | ✅ Re-retrieves from Stripe rather than trusting payloads |
| Out-of-order event safety | ✅ Every handler writes current truth |
| Subscription → app plan mapping | ✅ Single place (`lib/entitlements.ts`) |
| Cancel on account deletion | ✅ Best-effort, never blocks deletion |
| `STRIPE_SECRET_KEY` | ❌ empty |
| `STRIPE_WEBHOOK_SECRET` | ❌ empty |
| `STRIPE_PRICE_PRO_MONTHLY` | ❌ empty |
| `FRONTEND_URL` | ⚠️ unset → defaults to `http://localhost:5173` (fine for dev, **must be set in production**) |

### ⚠️ One blocker that affects you specifically

**Every one of your five accounts is now blocked from checkout.**

`POST /api/billing/checkout` refuses when the user already has an active plan:

```ts
const current = await entitlementsForUser(req.user!.id);
if (current.active) return res.status(409).json({ error: 'already-subscribed', ... });
```

The grandfather migration set `planOverride = 'unlimited'` on all five of you,
which makes `active: true`. So if you try to test payments with your own
account you will get **409 "You already have an active plan"** — not a Stripe
error, and nothing to do with your keys.

This is correct behaviour (why charge someone who already has access?), but it
means you need a test account. Either register a fresh one, or temporarily
demote yourself:

```sql
-- Free yourself up to test checkout
UPDATE "User" SET "planOverride" = 'free' WHERE email = 'you@yourteam.com';

-- Restore unlimited afterwards
UPDATE "User" SET "planOverride" = 'unlimited' WHERE email = 'you@yourteam.com';
```

---

## Stripe in the Philippines — read this before you start

Stripe **has** supported Philippine businesses since 2021, and PHP is a
supported currency, so ₱199/month works. Two things to know:

- **Payouts are PHP only**, to a Philippine bank account. There is no USD
  payout option on a PH account, and USD charges are auto-converted (you eat
  the FX spread).
- **A live account needs a registered business** (DTI or SEC) and the usual
  KYC. Stripe Atlas and full Connect are not available to PH accounts.

**For Demo Day you do not need any of this.** Test mode requires no business
registration, no bank account, and no approval. Everything below works in test
mode today; only Step 7 needs a real business.

---

## Setup

### 1. Create the account

Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register).
Leave it in **Test mode** — the toggle is at the top right. Test mode has its
own keys, its own products, and its own webhook secrets, and none of them work
in live mode.

### 2. Create the product and the ₱199 price

Dashboard → **Product catalogue** → **Add product**.

- Name: `HusAI Pro`
- Pricing model: **Recurring**
- Price: **199**, currency **PHP**, billing period **Monthly**

Save, then copy the **price ID** (`price_…`, not the product ID `prod_…`). If
you also want an annual price, add a second price to the *same* product and
copy that id too.

### 3. Get your secret key

Dashboard → **Developers → API keys** → copy the **Secret key** (`sk_test_…`).

Never commit this. `backend/.env` is gitignored; that is where it goes.

### 4. Forward webhooks to your machine

Without this, a successful payment never reaches your app and the user stays
on the free plan. This is the step people skip.

Install the CLI ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)), then:

```bash
stripe login
stripe listen --forward-to localhost:3001/api/billing/webhook
```

It prints a signing secret (`whsec_…`). **Leave this running while you test** —
it is the tunnel. The secret changes each time you start it fresh, so re-copy
it if you restart.

### 5. Fill in `backend/.env`

```bash
STRIPE_SECRET_KEY=sk_test_...............
STRIPE_WEBHOOK_SECRET=whsec_...............
STRIPE_PRICE_PRO_MONTHLY=price_...............
STRIPE_PRICE_PRO_YEARLY=            # optional
STRIPE_TRIAL_DAYS=0                 # set e.g. 7 to offer a free trial
FRONTEND_URL=http://localhost:5173  # where Stripe returns the user
```

Restart the backend. Confirm it took:

```bash
curl -s localhost:3001/api/billing/plans | head -c 400
```

You want `"configured": true` and a price with `"display": "₱199.00"`. If
`configured` is false the key did not load; if the price is missing, the price
id is wrong or belongs to live mode while your key is test mode.

### 6. Test a real payment

1. Sign in with an account that is **not** on `planOverride` (see the blocker above).
2. Go to **/plans** → **Upgrade**.
3. Use test card **`4242 4242 4242 4242`**, any future expiry, any CVC, any postcode.
4. Watch the `stripe listen` terminal — you should see
   `checkout.session.completed` and `customer.subscription.created`.
5. You land back on **/settings** and the plan should read **Pro**.

Verify it actually persisted rather than trusting the UI:

```sql
SELECT u.email, s.status, s."priceId", s."currentPeriodEnd"
  FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
 WHERE u.email = 'yourtestaccount@example.com';
```

`status` should be `active`.

**Other cards worth trying:**

| Card | Tests |
|---|---|
| `4000 0000 0000 9995` | Payment declined |
| `4000 0025 0000 3155` | 3D Secure authentication |
| `4000 0000 0000 0341` | Succeeds, then fails on renewal |

### 7. Going live (only when you have a registered business)

1. Complete **Activate payments** in the dashboard — business details, bank
   account, KYC.
2. Recreate the product and ₱199 price **in live mode** (test-mode objects do
   not carry over).
3. Dashboard → **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-api.onrender.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.trial_will_end`, `invoice.payment_succeeded`,
     `invoice.payment_failed`
4. Copy that endpoint's signing secret.
5. Set the **live** values in Render's environment (`sk_live_…`, the new
   `whsec_…`, the live `price_…`) and set `FRONTEND_URL` to your real domain.

---

## When something does not work

**"Payments are not enabled yet" (503)** — `STRIPE_SECRET_KEY` is not loaded.
Check `.env` spelling and restart the backend.

**"That plan is not available" (400)** — the `priceId` is not in
`STRIPE_PRICE_PRO_MONTHLY`/`_YEARLY`. Usually a live-mode id with a test-mode
key, or the product id (`prod_`) pasted instead of the price id (`price_`).

**"You already have an active plan" (409)** — the blocker above. Your account
has `planOverride` set.

**Payment succeeds but the plan stays Free** — the webhook is not arriving.
`stripe listen` not running, or `STRIPE_WEBHOOK_SECRET` does not match the
secret it printed. Check the backend log for
`webhook signature verification failed`.

**Prices show stale after a dashboard edit** — `plans.ts` caches for 5 minutes.
Wait, or restart the backend.

---

## The one thing that can silently go wrong

The landing page price is **hardcoded** in
`frontend/src/components/LandingPage.jsx`. Every other price in the app is read
live from Stripe and cannot drift. That one can. **If you change the price in
Stripe, change it there too**, or your marketing page will advertise a number
you do not charge.
