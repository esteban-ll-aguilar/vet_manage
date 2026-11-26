-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "CanalPago" AS ENUM ('EN_LINEA', 'RECEPCION', 'POS');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoReembolso" AS ENUM ('PENDIENTE', 'PARCIAL', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoNotificacionCita" AS ENUM ('REGISTRO', 'RECORDATORIO', 'CAMBIO_HORARIO', 'CANCELACION');

-- CreateEnum
CREATE TYPE "EstadoNotificacionCita" AS ENUM ('PENDIENTE', 'ENVIADA', 'NO_ENVIADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoOferta" AS ENUM ('VIGENTE', 'ACEPTADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "cambios_estado_cita" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "estado_anterior" "EstadoCita",
    "estado_nuevo" "EstadoCita" NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "realizado_por_id" UUID,
    "pago_id" UUID,

    CONSTRAINT "cambios_estado_cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reprogramaciones" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "fecha_hora_anterior" TIMESTAMP(3) NOT NULL,
    "fecha_hora_nueva" TIMESTAMP(3) NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizada_por_id" UUID NOT NULL,

    CONSTRAINT "reprogramaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_cita" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "tipo" "TipoNotificacionCita" NOT NULL,
    "correo_destino" VARCHAR(255),
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "fecha_envio" TIMESTAMP(3),
    "estado" "EstadoNotificacionCita" NOT NULL DEFAULT 'PENDIENTE',
    "causa" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificaciones_cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "referencia" VARCHAR(100) NOT NULL,
    "clave_idempotencia" VARCHAR(100),
    "importe" DECIMAL(12,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "canal" "CanalPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "numero_lote" VARCHAR(50),
    "comprobante" VARCHAR(500),
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_reembolso" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "importe_autorizado" DECIMAL(12,2) NOT NULL,
    "justificacion" TEXT NOT NULL,
    "fecha_autorizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoReembolso" NOT NULL DEFAULT 'PENDIENTE',
    "autorizada_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_reembolso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" UUID NOT NULL,
    "orden_reembolso_id" UUID NOT NULL,
    "referencia" VARCHAR(100) NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "comprobante" VARCHAR(500),
    "realizada_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_espera" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha" DATE NOT NULL,
    "hora_desde" TIME(0) NOT NULL,
    "hora_hasta" TIME(0) NOT NULL,

    CONSTRAINT "solicitudes_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas_turno" (
    "id" UUID NOT NULL,
    "solicitud_espera_id" UUID NOT NULL,
    "sala_id" UUID NOT NULL,
    "veterinario_id" UUID NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "fecha_hora_fin" TIMESTAMP(3) NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoOferta" NOT NULL DEFAULT 'VIGENTE',
    "cita_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ofertas_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambios_estado_cita_cita_id_fecha_hora_idx" ON "cambios_estado_cita"("cita_id", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "reprogramaciones_cita_id_key" ON "reprogramaciones"("cita_id");

-- CreateIndex
CREATE INDEX "notificaciones_cita_cita_id_idx" ON "notificaciones_cita"("cita_id");

-- CreateIndex
CREATE INDEX "notificaciones_cita_estado_fecha_programada_idx" ON "notificaciones_cita"("estado", "fecha_programada");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_referencia_key" ON "pagos"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_clave_idempotencia_key" ON "pagos"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "pagos_cita_id_estado_idx" ON "pagos"("cita_id", "estado");

-- CreateIndex
CREATE INDEX "pagos_canal_fecha_hora_idx" ON "pagos"("canal", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_reembolso_cita_id_key" ON "ordenes_reembolso"("cita_id");

-- CreateIndex
CREATE INDEX "ordenes_reembolso_estado_idx" ON "ordenes_reembolso"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_referencia_key" ON "devoluciones"("referencia");

-- CreateIndex
CREATE INDEX "devoluciones_orden_reembolso_id_estado_idx" ON "devoluciones"("orden_reembolso_id", "estado");

-- CreateIndex
CREATE INDEX "solicitudes_espera_sucursal_id_fecha_fecha_registro_idx" ON "solicitudes_espera"("sucursal_id", "fecha", "fecha_registro");

-- CreateIndex
CREATE INDEX "solicitudes_espera_paciente_id_idx" ON "solicitudes_espera"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_turno_cita_id_key" ON "ofertas_turno"("cita_id");

-- CreateIndex
CREATE INDEX "ofertas_turno_solicitud_espera_id_idx" ON "ofertas_turno"("solicitud_espera_id");

-- CreateIndex
CREATE INDEX "ofertas_turno_estado_vence_en_idx" ON "ofertas_turno"("estado", "vence_en");

-- CreateIndex
CREATE INDEX "ofertas_turno_veterinario_id_fecha_hora_idx" ON "ofertas_turno"("veterinario_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "ofertas_turno_sala_id_fecha_hora_idx" ON "ofertas_turno"("sala_id", "fecha_hora");

-- AddForeignKey
ALTER TABLE "cambios_estado_cita" ADD CONSTRAINT "cambios_estado_cita_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_estado_cita" ADD CONSTRAINT "cambios_estado_cita_realizado_por_id_fkey" FOREIGN KEY ("realizado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_estado_cita" ADD CONSTRAINT "cambios_estado_cita_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramaciones" ADD CONSTRAINT "reprogramaciones_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprogramaciones" ADD CONSTRAINT "reprogramaciones_realizada_por_id_fkey" FOREIGN KEY ("realizada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_cita" ADD CONSTRAINT "notificaciones_cita_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_reembolso" ADD CONSTRAINT "ordenes_reembolso_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_reembolso" ADD CONSTRAINT "ordenes_reembolso_autorizada_por_id_fkey" FOREIGN KEY ("autorizada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_orden_reembolso_id_fkey" FOREIGN KEY ("orden_reembolso_id") REFERENCES "ordenes_reembolso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_realizada_por_id_fkey" FOREIGN KEY ("realizada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_espera" ADD CONSTRAINT "solicitudes_espera_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_espera" ADD CONSTRAINT "solicitudes_espera_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_espera" ADD CONSTRAINT "solicitudes_espera_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_turno" ADD CONSTRAINT "ofertas_turno_solicitud_espera_id_fkey" FOREIGN KEY ("solicitud_espera_id") REFERENCES "solicitudes_espera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_turno" ADD CONSTRAINT "ofertas_turno_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_turno" ADD CONSTRAINT "ofertas_turno_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_turno" ADD CONSTRAINT "ofertas_turno_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

