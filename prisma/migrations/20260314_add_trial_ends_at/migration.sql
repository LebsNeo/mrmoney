-- Add trial_ends_at column to organisations
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
