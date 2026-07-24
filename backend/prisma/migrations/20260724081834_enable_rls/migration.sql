-- Row Level Security (RLS) hardening.
--
-- Context: the backend connects as the Supabase `postgres` role, which has
-- BYPASSRLS, so enabling RLS does NOT affect any Prisma query — the app keeps
-- working exactly as before. RLS + these policies are a defense-in-depth layer
-- against the auto-generated Supabase Data API (PostgREST), which uses the
-- `anon` / `authenticated` roles. With RLS on and no permissive anon policy,
-- those roles can only ever touch a user's OWN rows (and anon: nothing).
--
-- Idempotent on purpose: safe to re-run (ENABLE RLS is a no-op if already on;
-- policies are dropped-then-created), so `prisma migrate deploy` never fails
-- even if this was also applied manually.

-- 1) Enable RLS on every table holding user data.
ALTER TABLE "User"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Meeting"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeTurn"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgressMetric"  ENABLE ROW LEVEL SECURITY;

-- 2) Per-user policies for the `authenticated` role (a signed-in user's JWT).
--    auth.uid() is the Supabase user id; our id/userId columns are text.
--    No policy is created for `anon`, so anonymous access is denied outright.

DROP POLICY IF EXISTS "own_rows" ON "User";
CREATE POLICY "own_rows" ON "User" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "id")
  WITH CHECK ((SELECT auth.uid())::text = "id");

DROP POLICY IF EXISTS "own_rows" ON "UserSettings";
CREATE POLICY "own_rows" ON "UserSettings" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");

DROP POLICY IF EXISTS "own_rows" ON "Meeting";
CREATE POLICY "own_rows" ON "Meeting" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");

DROP POLICY IF EXISTS "own_rows" ON "Review";
CREATE POLICY "own_rows" ON "Review" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");

DROP POLICY IF EXISTS "own_rows" ON "PracticeSession";
CREATE POLICY "own_rows" ON "PracticeSession" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");

DROP POLICY IF EXISTS "own_rows" ON "ProgressMetric";
CREATE POLICY "own_rows" ON "ProgressMetric" FOR ALL TO authenticated
  USING ((SELECT auth.uid())::text = "userId")
  WITH CHECK ((SELECT auth.uid())::text = "userId");

-- PracticeTurn has no userId — ownership flows through its parent session.
DROP POLICY IF EXISTS "own_rows" ON "PracticeTurn";
CREATE POLICY "own_rows" ON "PracticeTurn" FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "PracticeSession" s
    WHERE s."id" = "PracticeTurn"."sessionId" AND (SELECT auth.uid())::text = s."userId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "PracticeSession" s
    WHERE s."id" = "PracticeTurn"."sessionId" AND (SELECT auth.uid())::text = s."userId"
  ));
