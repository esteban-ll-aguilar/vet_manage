-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "expiration_date" DATE NOT NULL,
    "initial_quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batches_product_id_idx" ON "batches"("product_id");

-- CreateIndex
CREATE INDEX "batches_expiration_date_idx" ON "batches"("expiration_date");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
