-- HU-03 Dar de baja un cliente: fecha, responsable y motivo de la baja.
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by_id" UUID,
ADD COLUMN     "deactivation_reason" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_deactivated_by_id_fkey" FOREIGN KEY ("deactivated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
