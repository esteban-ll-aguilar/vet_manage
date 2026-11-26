
# Tasks

## Layer 0 — OpenSpec y contrato

- [x] 0.1 Crear proposal, design y spec de HU-006.
- [ ] 0.2 Confirmar contrato de consulta y respuesta de disponibilidad.
- [ ] 0.3 Resolver qué estados de cita bloquean recursos.
- [x] 0.4 Crear DTO inicial de consulta.

## Layer 1 — Backend

- [ ] 1.1 Crear repositorio de consulta de recursos disponibles.
- [ ] 1.2 Crear servicio de disponibilidad y validaciones.
- [ ] 1.3 Validar jornadas, disponibilidad diaria y turnos de sábado.
- [ ] 1.4 Excluir veterinarios y consultorios ocupados por citas.
- [ ] 1.5 Aplicar bloqueos activos de veterinario y sucursal.
- [ ] 1.6 Crear controller protegido con `resources:read-availability`.
- [ ] 1.7 Registrar controller y providers en `ResourcesModule`.

## Layer 2 — Pruebas

- [ ] 2.1 CP-006-01: Consultar los recursos que realmente están libres.
- [ ] 2.2 CP-006-02: Excluir a un veterinario con horario bloqueado.
- [ ] 2.3 CP-006-03: Consultar cuando falta un recurso.
- [ ] 2.4 CP-006-04: Consultar una fecha pasada.
- [ ] 2.5 CP-006-05: Consultar una duración inválida.
- [ ] 2.6 Verificar permisos 401/403.

## Layer 3 — Frontend

- [ ] 3.1 Agregar tipos y método de consulta a `scheduling-api.ts`.
- [ ] 3.2 Integrar la consulta en la interfaz correspondiente.
- [ ] 3.3 Respetar los permisos y componentes existentes.

## Layer 4 — Verificación

- [ ] 4.1 Ejecutar pruebas enfocadas de HU-006.
- [ ] 4.2 Ejecutar suites completas, lint y builds.
- [ ] 4.3 Revisar los cambios de Git para confirmar que no afectan otras HU.

## Pending

- Confirmar qué estados de cita deben bloquear la disponibilidad. HU-019 considera `PROGRAMADA` y `CONFIRMADA`, mientras que HU-014 utiliza todas excepto `CANCELADA`.
- Confirmar el contrato exacto de respuesta cuando falta un veterinario o consultorio.
- Confirmar el endpoint definitivo y la integración frontend antes de implementarlos.
