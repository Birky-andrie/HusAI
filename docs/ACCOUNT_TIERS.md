# Managing account tiers (prototype)

How to see and change what any account is allowed to do, while the product is
still pre-launch and tiers are granted by hand rather than bought.

---

## The one-minute version

Every user's tier is decided by **one column**: `User.planOverride`.

| Value | What they get |
|---|---|
| `'unlimited'` | Everything, no quota. What all existing alpha users were given. |
| `'pro'` | Same as unlimited — the word just records *why* (treat as a paying customer). |
| `'free'` | Forced onto free limits **even if they have a paid Stripe subscription**. |
| `NULL` | Normal behaviour: their Stripe subscription decides. New signups land here → free tier. |

To make someone Pro, set that column. To take it away, set it back to `NULL`.
Nothing else needs touching.

---

## Where to click (Supabase)

1. Go to your project at [supabase.com](https://supabase.com) → **Table Editor**.
2. Open the **`User`** table.
3. Find the row by `email`.
4. Edit two columns:
   - **`planOverride`** → `unlimited`
   - **`planOverrideNote`** → why, e.g. `Demo Day judge account`
5. Save. It takes effect on their next request — no redeploy, no sign-out.

### Or with SQL

Supabase → **SQL Editor**:

```sql
-- Grant unlimited access
UPDATE "User"
   SET "planOverride" = 'unlimited',
       "planOverrideNote" = 'Demo Day judge, 2026-07-31'
 WHERE email = 'someone@example.com';

-- Revoke it (back to normal Stripe-driven behaviour)
UPDATE "User"
   SET "planOverride" = NULL,
       "planOverrideNote" = NULL
 WHERE email = 'someone@example.com';

-- Force someone onto free limits for testing, even though they pay
UPDATE "User"
   SET "planOverride" = 'free',
       "planOverrideNote" = 'Testing the free-tier gate'
 WHERE email = 'you@yourteam.com';
```

### See who has what

```sql
SELECT u.email,
       u."planOverride",
       u."planOverrideNote",
       s.status AS stripe_status,
       u."createdAt"
  FROM "User" u
  LEFT JOIN "Subscription" s ON s."userId" = u.id
 ORDER BY u."createdAt" DESC;
```

### Check someone's usage this month

```sql
SELECT COUNT(*)                                  AS calls_used,
       CEIL(COALESCE(SUM("durationSeconds"),0)/60.0) AS minutes_used
  FROM "Meeting"
 WHERE "userId" = (SELECT id FROM "User" WHERE email = 'someone@example.com')
   AND "startedAt" >= date_trunc('month', now() AT TIME ZONE 'UTC');
```

---

## Who currently has access, and why

The migration `20260731090000_tiers_usage_terms` ran this once:

```sql
UPDATE "User"
   SET "planOverride" = 'unlimited',
       "planOverrideNote" = 'Alpha user, grandfathered on 2026-07-31'
 WHERE "planOverride" IS NULL;
```

So **everyone who had an account before that migration ran keeps full access**,
and **everyone who signs up after it lands on the free tier**. That is the
"current users keep max, new users don't" requirement.

This is deliberately a one-time `UPDATE`, **not** a column `DEFAULT`. A default
would silently grant unlimited access to every future signup too — the exact
opposite of what is wanted.

---

## The free tier

Defined in `backend/src/lib/entitlements.ts`:

```ts
export const FREE_LIMITS: Limits = {
  callsPerMonth: 3,
  minutesPerMonth: 30,
};
```

Change the numbers there — one place, and every gate, meter, and message
follows. The limit copy shown to users is generated from these values, so it
cannot fall out of step with them.

**Both limits apply.** Whichever runs out first stops the user.

### How usage is counted

Usage is **derived** by aggregating the `Meeting` table for the current
calendar month, not stored in a counter column. A counter is a second source
of truth that drifts the first time a save is retried or a meeting is deleted;
the meeting rows are the actual record of what happened.

Practical consequences:

- **Deleting a meeting gives the minutes back.** That is correct behaviour, but
  worth knowing if a user asks.
- **The month boundary is UTC.** Users are in PH (UTC+8), so a call at 07:00
  Manila on the 1st counts against the *previous* month. Acceptable for a
  prototype. To fix it, change `periodStart`/`periodEnd` in
  `backend/src/lib/usage.ts` to use Asia/Manila — nothing else needs to change.

### What happens when someone runs out

The call still **saves**. Only the AI review is gated.

This is a deliberate choice, and please keep it: refusing to store the
transcript would destroy the user's data to enforce a billing rule, and a user
who thinks their call vanished will not upgrade — they will stop trusting the
product. They see an upgrade prompt, and the transcript stays readable in
History.

---

## Precedence — the part that surprises people

`planOverride` **beats Stripe.** If someone is set to `'unlimited'` and their
subscription lapses, they keep unlimited access until you clear the override.

That is intentional: a support grant must not be silently undone the next time
a webhook lands. But it also means **an override left on an account is
invisible revenue leakage**. Use `planOverrideNote` on every grant, and audit
periodically:

```sql
SELECT email, "planOverride", "planOverrideNote"
  FROM "User"
 WHERE "planOverride" IS NOT NULL;
```

---

## Gating a feature behind Pro

**Server** — the only place that actually enforces anything:

```ts
import { requireActivePlan } from '../../lib/entitlements.js';

router.post('/some-feature', authRequired, requireActivePlan('Call reviews'), handler);
```

Responds `402` with `{ error: 'upgrade-required', feature }`.

**Client** — presentation only:

```jsx
import ProLock from '../billing/ProLock.jsx';
import { useUsage } from '../billing/useUsage.js';

const { status } = useUsage();

<ProLock feature="call reviews" locked={!status?.entitlements.active}>
  <TheRealFeature />
</ProLock>
```

`ProLock` renders the real feature at 60% opacity behind an upgrade card, and
makes it inert so keyboard and screen-reader users are not walked through dead
controls.

> Never gate a feature on the client alone. Anyone can delete a DOM node. The
> `ProLock` is there so users understand what they are missing, not to stop
> them — that is `requireActivePlan`'s job.

---

## Terms acceptance

`User.termsAcceptedAt` and `User.termsAcceptedVersion` record consent.
`TERMS_VERSION` lives in `backend/src/lib/terms.ts` and must match the version
shown in `frontend/src/pages/TermsPage.jsx`.

**Bump `TERMS_VERSION` whenever the terms change materially.** Every user is
then asked to accept again, which is the point: under RA 10173 consent is
specific to what was disclosed, so agreement to the old text is not agreement
to the new one.

To see who has not accepted the current version:

```sql
SELECT email, "termsAcceptedAt", "termsAcceptedVersion"
  FROM "User"
 WHERE "termsAcceptedVersion" IS DISTINCT FROM '2026-07-31';
```

---

## Applying the migration

The schema changes are **not yet applied to your database**. When you are ready:

```bash
cd backend
npx prisma migrate deploy
```

Every column added is nullable or defaulted, so this is safe to run against the
live database with existing rows and needs no backfill. The one data change is
the grandfather `UPDATE` described above — check the current user list before
running it if you want to be sure who is about to be granted access.
