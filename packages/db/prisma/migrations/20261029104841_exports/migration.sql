-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('LOGO_PACK', 'GUIDELINES_PDF');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "guidelines" JSONB;

-- CreateTable
CREATE TABLE "Export" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "type" "ExportType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "brandVersion" INTEGER NOT NULL,
    "watermarked" BOOLEAN NOT NULL,
    "includesVector" BOOLEAN NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "quotaCharged" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Export_organizationId_createdAt_idx" ON "Export"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolation entre organisations (§9.1), comme les autres tables métier.
ALTER TABLE "Export" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Export"
  USING ("organizationId" = app_current_org())
  WITH CHECK ("organizationId" = app_current_org());
