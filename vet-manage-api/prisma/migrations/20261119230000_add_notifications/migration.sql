-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAJA');

-- CreateTable
CREATE TABLE "notification_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "rolesDestino" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "detalle" TEXT,
    "prioridad" "NotificationPriority" NOT NULL DEFAULT 'MEDIA',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_types_code_key" ON "notification_types"("code");

-- CreateIndex
CREATE INDEX "notification_types_is_active_idx" ON "notification_types"("is_active");

-- CreateIndex
CREATE INDEX "notifications_user_id_leida_idx" ON "notifications"("user_id", "leida");

-- CreateIndex
CREATE INDEX "notifications_user_id_issued_at_idx" ON "notifications"("user_id", "issued_at");

-- CreateIndex
CREATE INDEX "notifications_entity_type_entity_id_idx" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_type_id_idx" ON "notifications"("type_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "notification_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
