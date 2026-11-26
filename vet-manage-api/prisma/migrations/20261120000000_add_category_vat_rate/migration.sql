-- AlterTable
ALTER TABLE "categories" ADD COLUMN "vat_rate" DECIMAL(5,2);

-- AddConstraint
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_vat_rate_range_check"
  CHECK ("vat_rate" IS NULL OR "vat_rate" BETWEEN 0 AND 100);
