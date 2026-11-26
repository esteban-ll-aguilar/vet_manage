-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ReproductiveStatus" AS ENUM ('STERILIZED', 'NOT_STERILIZED', 'UNKNOWN');

-- Secuencia del código identificador del paciente (PAC-000001).
CREATE SEQUENCE "pet_code_seq" START WITH 1 INCREMENT BY 1;

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL DEFAULT ('PAC-'::text || lpad((nextval('pet_code_seq'::regclass))::text, 6, '0'::text)),
    "name" VARCHAR(100) NOT NULL,
    "sex" "PetSex" NOT NULL,
    "birth_date" DATE NOT NULL,
    "weight_kg" DECIMAL(6,2) NOT NULL,
    "height_cm" DECIMAL(6,2) NOT NULL,
    "reproductive_status" "ReproductiveStatus" NOT NULL,
    "color" VARCHAR(50),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "client_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "breed_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- La secuencia pertenece a la columna: se elimina junto con la tabla.
ALTER SEQUENCE "pet_code_seq" OWNED BY "pets"."code";

-- CreateIndex
CREATE UNIQUE INDEX "pets_code_key" ON "pets"("code");

-- CreateIndex
CREATE INDEX "pets_client_id_idx" ON "pets"("client_id");

-- CreateIndex
CREATE INDEX "pets_status_idx" ON "pets"("status");

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
