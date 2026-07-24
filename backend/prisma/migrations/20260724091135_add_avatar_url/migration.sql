-- Add a nullable avatar column to User (small base64 data URL or hosted URL).
-- Nullable + no default → safe, instant, non-blocking on the existing table.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
