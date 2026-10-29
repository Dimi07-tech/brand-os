-- AlterEnum
ALTER TYPE "ExportType" ADD VALUE 'BUSINESS_DOCUMENT_PDF';

-- AlterTable
ALTER TABLE "BusinessDocument" ADD COLUMN     "clientSnapshot" JSONB,
ADD COLUMN     "discountMinor" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Export" ADD COLUMN     "documentId" UUID;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unit" TEXT;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "BusinessDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
