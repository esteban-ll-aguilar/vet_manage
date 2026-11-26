-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_ruc_key" ON "suppliers"("ruc");
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");
