-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_person_id_key" ON "clients"("person_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: toda persona con rol client activo pasa a tener su registro Client.
INSERT INTO "clients" ("id", "person_id", "status", "created_at", "updated_at")
SELECT gen_random_uuid(), p."id", 'ACTIVE', NOW(), NOW()
FROM "persons" p
JOIN "users" u ON u."person_id" = p."id"
JOIN "user_roles" ur ON ur."user_id" = u."id"
JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."name" = 'client'
  AND r."is_active" = true
  AND (ur."expires_at" IS NULL OR ur."expires_at" > NOW())
ON CONFLICT ("person_id") DO NOTHING;
