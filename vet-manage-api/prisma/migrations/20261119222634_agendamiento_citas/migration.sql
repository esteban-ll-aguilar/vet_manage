-- CreateEnum
CREATE TYPE "TipoSala" AS ENUM ('CONSULTORIO', 'QUIROFANO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "TipoCita" AS ENUM ('CONSULTA', 'CIRUGIA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "TipoCancelacion" AS ENUM ('ORDINARIA', 'EXCEPCIONAL');

-- CreateTable
CREATE TABLE "sucursales" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salas" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" "TipoSala" NOT NULL DEFAULT 'CONSULTORIO',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "duracion_maxima_min" INTEGER NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas" (
    "id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha_vigencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_base" (
    "id" UUID NOT NULL,
    "veterinario_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horarios_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidades_diarias" (
    "id" UUID NOT NULL,
    "horario_base_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disponibilidades_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_sabado" (
    "id" UUID NOT NULL,
    "horario_base_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "justificacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_sabado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos_horario" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "veterinario_id" UUID,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "motivo" TEXT NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "eliminado_por_id" UUID,
    "fecha_eliminacion" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloqueos_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "tipo" "TipoCita" NOT NULL DEFAULT 'CONSULTA',
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "fecha_hora_fin" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "importe_reserva" DECIMAL(12,2) NOT NULL,
    "tipo_cancelacion" "TipoCancelacion",
    "asistencia_declarada" TIMESTAMP(3),
    "paciente_id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "servicio_id" UUID,
    "veterinario_id" UUID NOT NULL,
    "registrada_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_nombre_key" ON "sucursales"("nombre");

-- CreateIndex
CREATE INDEX "salas_sucursal_id_tipo_estado_idx" ON "salas"("sucursal_id", "tipo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "salas_sucursal_id_nombre_key" ON "salas"("sucursal_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_nombre_key" ON "servicios"("nombre");

-- CreateIndex
CREATE INDEX "servicios_estado_idx" ON "servicios"("estado");

-- CreateIndex
CREATE INDEX "tarifas_servicio_id_sucursal_id_estado_idx" ON "tarifas"("servicio_id", "sucursal_id", "estado");

-- CreateIndex
CREATE INDEX "horarios_base_veterinario_id_dia_semana_estado_idx" ON "horarios_base"("veterinario_id", "dia_semana", "estado");

-- CreateIndex
CREATE INDEX "horarios_base_sucursal_id_dia_semana_idx" ON "horarios_base"("sucursal_id", "dia_semana");

-- CreateIndex
CREATE INDEX "disponibilidades_diarias_horario_base_id_fecha_idx" ON "disponibilidades_diarias"("horario_base_id", "fecha");

-- CreateIndex
CREATE INDEX "turnos_sabado_horario_base_id_idx" ON "turnos_sabado"("horario_base_id");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_sabado_sucursal_id_fecha_key" ON "turnos_sabado"("sucursal_id", "fecha");

-- CreateIndex
CREATE INDEX "bloqueos_horario_sucursal_id_fecha_fecha_eliminacion_idx" ON "bloqueos_horario"("sucursal_id", "fecha", "fecha_eliminacion");

-- CreateIndex
CREATE INDEX "bloqueos_horario_veterinario_id_fecha_idx" ON "bloqueos_horario"("veterinario_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "citas_numero_key" ON "citas"("numero");

-- CreateIndex
CREATE INDEX "citas_veterinario_id_fecha_hora_idx" ON "citas"("veterinario_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "citas_sala_id_fecha_hora_idx" ON "citas"("sala_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "citas_paciente_id_fecha_hora_idx" ON "citas"("paciente_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "citas_estado_idx" ON "citas"("estado");

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_base" ADD CONSTRAINT "horarios_base_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_base" ADD CONSTRAINT "horarios_base_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades_diarias" ADD CONSTRAINT "disponibilidades_diarias_horario_base_id_fkey" FOREIGN KEY ("horario_base_id") REFERENCES "horarios_base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_sabado" ADD CONSTRAINT "turnos_sabado_horario_base_id_fkey" FOREIGN KEY ("horario_base_id") REFERENCES "horarios_base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_sabado" ADD CONSTRAINT "turnos_sabado_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_horario" ADD CONSTRAINT "bloqueos_horario_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_horario" ADD CONSTRAINT "bloqueos_horario_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_horario" ADD CONSTRAINT "bloqueos_horario_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_horario" ADD CONSTRAINT "bloqueos_horario_eliminado_por_id_fkey" FOREIGN KEY ("eliminado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
