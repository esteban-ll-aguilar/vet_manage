-- Renombra el paciente según el diagrama de clases (Paciente → Patient). Solo cambia nombres: no se pierden datos.

-- Tabla
ALTER TABLE "pets" RENAME TO "patients";

-- Columna sex → gender (genero en el diagrama) y su enum
ALTER TABLE "patients" RENAME COLUMN "sex" TO "gender";
ALTER TYPE "PetSex" RENAME TO "Gender";

-- Secuencia del código identificador (el DEFAULT la referencia por OID, así que sigue funcionando)
ALTER SEQUENCE "pet_code_seq" RENAME TO "patient_code_seq";

-- Clave primaria, índices y claves foráneas con el nombre de la nueva tabla
ALTER TABLE "patients" RENAME CONSTRAINT "pets_pkey" TO "patients_pkey";
ALTER INDEX "pets_code_key" RENAME TO "patients_code_key";
ALTER INDEX "pets_client_id_idx" RENAME TO "patients_client_id_idx";
ALTER INDEX "pets_status_idx" RENAME TO "patients_status_idx";
ALTER TABLE "patients" RENAME CONSTRAINT "pets_client_id_fkey" TO "patients_client_id_fkey";
ALTER TABLE "patients" RENAME CONSTRAINT "pets_species_id_fkey" TO "patients_species_id_fkey";
ALTER TABLE "patients" RENAME CONSTRAINT "pets_breed_id_fkey" TO "patients_breed_id_fkey";
