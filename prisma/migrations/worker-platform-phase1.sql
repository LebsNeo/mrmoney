ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "tip_entries" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "propertyId" TEXT,
  "bookingId" TEXT,
  "amount" DECIMAL(19,4) NOT NULL,
  "tipDate" DATE NOT NULL,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "tip_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "worker_savings_goals" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "targetAmount" DECIMAL(19,4) NOT NULL,
  "savedAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "weeklyTarget" DECIMAL(19,4),
  "deadline" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_savings_goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stokvels" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyAmount" DECIMAL(19,4) NOT NULL,
  "totalBalance" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "payoutMonth" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stokvels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stokvel_members" (
  "id" TEXT NOT NULL,
  "stokvelId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "stokvel_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stokvel_contributions" (
  "id" TEXT NOT NULL,
  "stokvelId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "period" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stokvel_contributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tip_entries_organisationId_idx" ON "tip_entries"("organisationId");
CREATE INDEX IF NOT EXISTS "tip_entries_employeeId_idx" ON "tip_entries"("employeeId");
CREATE INDEX IF NOT EXISTS "tip_entries_bookingId_idx" ON "tip_entries"("bookingId");
CREATE INDEX IF NOT EXISTS "worker_savings_goals_employeeId_idx" ON "worker_savings_goals"("employeeId");
CREATE INDEX IF NOT EXISTS "worker_savings_goals_organisationId_idx" ON "worker_savings_goals"("organisationId");
CREATE INDEX IF NOT EXISTS "stokvels_organisationId_idx" ON "stokvels"("organisationId");
CREATE UNIQUE INDEX IF NOT EXISTS "stokvel_members_stokvelId_employeeId_key" ON "stokvel_members"("stokvelId", "employeeId");
CREATE INDEX IF NOT EXISTS "stokvel_members_employeeId_idx" ON "stokvel_members"("employeeId");
CREATE INDEX IF NOT EXISTS "stokvel_contributions_stokvelId_idx" ON "stokvel_contributions"("stokvelId");
CREATE INDEX IF NOT EXISTS "stokvel_contributions_employeeId_idx" ON "stokvel_contributions"("employeeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tip_entries_organisationId_fkey') THEN
    ALTER TABLE "tip_entries"
    ADD CONSTRAINT "tip_entries_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tip_entries_employeeId_fkey') THEN
    ALTER TABLE "tip_entries"
    ADD CONSTRAINT "tip_entries_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tip_entries_propertyId_fkey') THEN
    ALTER TABLE "tip_entries"
    ADD CONSTRAINT "tip_entries_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tip_entries_bookingId_fkey') THEN
    ALTER TABLE "tip_entries"
    ADD CONSTRAINT "tip_entries_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_savings_goals_employeeId_fkey') THEN
    ALTER TABLE "worker_savings_goals"
    ADD CONSTRAINT "worker_savings_goals_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_savings_goals_organisationId_fkey') THEN
    ALTER TABLE "worker_savings_goals"
    ADD CONSTRAINT "worker_savings_goals_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stokvels_organisationId_fkey') THEN
    ALTER TABLE "stokvels"
    ADD CONSTRAINT "stokvels_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stokvel_members_stokvelId_fkey') THEN
    ALTER TABLE "stokvel_members"
    ADD CONSTRAINT "stokvel_members_stokvelId_fkey"
    FOREIGN KEY ("stokvelId") REFERENCES "stokvels"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stokvel_members_employeeId_fkey') THEN
    ALTER TABLE "stokvel_members"
    ADD CONSTRAINT "stokvel_members_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stokvel_contributions_stokvelId_fkey') THEN
    ALTER TABLE "stokvel_contributions"
    ADD CONSTRAINT "stokvel_contributions_stokvelId_fkey"
    FOREIGN KEY ("stokvelId") REFERENCES "stokvels"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stokvel_contributions_employeeId_fkey') THEN
    ALTER TABLE "stokvel_contributions"
    ADD CONSTRAINT "stokvel_contributions_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
