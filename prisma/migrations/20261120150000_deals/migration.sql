-- CreateTable
CREATE TABLE IF NOT EXISTS "Deal" (
    "id" TEXT NOT NULL,
    "badge" TEXT NOT NULL DEFAULT 'Προσφορά',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "cta" TEXT NOT NULL DEFAULT 'Κλείσε τώρα',
    "priceLabel" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'FREE_DAYS',
    "dealValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "paidDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "minDays" INTEGER,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_organizationId_active_idx" ON "Deal"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "Deal_categoryId_idx" ON "Deal"("categoryId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "VehicleCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
