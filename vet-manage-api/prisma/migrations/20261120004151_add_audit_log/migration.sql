-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(255) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "affected_record" VARCHAR(255) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_module_action_idx" ON "audit_logs"("module", "action");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los registros de auditoría son de solo lectura: se rechaza modificarlos o eliminarlos.
CREATE FUNCTION "audit_logs_reject_change"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría no se pueden modificar ni eliminar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_read_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_change"();
