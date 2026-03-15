-- Create StokvelType enum
DO $$ BEGIN
  CREATE TYPE "StokvelType" AS ENUM ('SAVINGS', 'ROTATING', 'GROCERY', 'BURIAL', 'INVESTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to stokvels
ALTER TABLE "stokvels"
ADD COLUMN IF NOT EXISTS "type" "StokvelType" NOT NULL DEFAULT 'SAVINGS',
ADD COLUMN IF NOT EXISTS "meetingDay" INTEGER,
ADD COLUMN IF NOT EXISTS "meetingTime" TEXT,
ADD COLUMN IF NOT EXISTS "nextMeetingHost" TEXT,
ADD COLUMN IF NOT EXISTS "autoDeduct" BOOLEAN NOT NULL DEFAULT false;

-- Add new columns to stokvel_contributions
ALTER TABLE "stokvel_contributions"
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "payrollEntryId" TEXT;
