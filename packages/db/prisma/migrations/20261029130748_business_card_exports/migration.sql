-- AlterEnum
ALTER TYPE "ExportType" ADD VALUE 'BUSINESS_CARD_PDF';

-- AlterTable
ALTER TABLE "Export" ADD COLUMN     "designId" UUID;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
