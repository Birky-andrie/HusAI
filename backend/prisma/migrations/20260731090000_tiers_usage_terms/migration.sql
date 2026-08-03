-- Tiering, usage limits, timestamped transcripts, score breakdowns, and
-- Data Privacy Act consent records.
--
-- Every column here is nullable or defaulted, so this migration is safe to run
-- against a live database with existing rows and requires no backfill to keep
-- the app working.

-- 1. Manual tier lever. `planOverride` beats the Stripe subscription so a
--    support grant is not undone by the next webhook. See lib/entitlements.ts.
ALTER TABLE "User" ADD COLUMN "planOverride" TEXT;
ALTER TABLE "User" ADD COLUMN "planOverrideNote" TEXT;

-- 2. Terms acceptance. The VERSION is stored, not just a boolean: under RA
--    10173 consent is specific to what was disclosed, so agreement to an
--    earlier document is not agreement to a later one.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsAcceptedVersion" TEXT;

-- 3. Timestamped transcript. Additive — `transcript` remains the source of
--    truth for the AI prompts and for every meeting recorded before this.
ALTER TABLE "Meeting" ADD COLUMN "transcriptJson" TEXT;

-- 4. Per-dimension score breakdown ("why did I get this score").
ALTER TABLE "Review" ADD COLUMN "scoreDetailsJson" TEXT;

-- 5. Usage is derived by aggregating meetings within the current calendar
--    month (see lib/usage.ts). That query filters on userId + startedAt, so it
--    gets an index rather than a sequential scan on every call start.
CREATE INDEX "Meeting_userId_startedAt_idx" ON "Meeting"("userId", "startedAt");

-- 6. Grandfather everyone who already has an account.
--
--    This is the "current users keep max access, new users are on free"
--    requirement. It is a one-time data statement, deliberately NOT a default
--    on the column: a DEFAULT would silently grant unlimited access to every
--    future signup too, which is the exact opposite of what is wanted. Anyone
--    created after this migration runs gets NULL and therefore free-tier
--    limits.
UPDATE "User"
   SET "planOverride" = 'unlimited',
       "planOverrideNote" = 'Alpha user, grandfathered on 2026-07-31'
 WHERE "planOverride" IS NULL;
