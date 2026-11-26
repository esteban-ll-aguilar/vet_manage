ALTER TABLE "batches"
ADD COLUMN "available_quantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "batches"
SET "available_quantity" = "initial_quantity";
