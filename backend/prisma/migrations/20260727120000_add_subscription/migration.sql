-- Subscription: billing state mirrored from the payment provider (Stripe today,
-- PayMongo/GCash later via the `provider` column). No amounts are stored here —
-- prices live in the provider's dashboard and are resolved at request time.
--
-- Idempotent (IF NOT EXISTS / DROP-then-CREATE for the policy) so re-running
-- `prisma migrate deploy` is always safe, matching the enable_rls migration.

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "provider"          TEXT NOT NULL DEFAULT 'stripe',
  "customerId"        TEXT,
  "subscriptionId"    TEXT,
  "status"            TEXT NOT NULL DEFAULT 'free',
  "priceId"           TEXT,
  "interval"          TEXT,
  "currentPeriodEnd"  TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "trialEndsAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_subscriptionId_key" ON "Subscription"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_customerId_idx" ON "Subscription"("customerId");

DO $$
BEGIN
  ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS, same rationale as 20260724081834_enable_rls: the backend connects as
-- `postgres` (BYPASSRLS) so Prisma is unaffected. This locks down the
-- auto-exposed Supabase Data API — `authenticated` sees only its own row, and
-- `anon` gets no policy at all, so anonymous access is denied outright.
-- Billing rows are read-only to clients in practice; all writes go through the
-- backend's webhook handler.
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_rows" ON "Subscription";
CREATE POLICY "own_rows" ON "Subscription" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");
