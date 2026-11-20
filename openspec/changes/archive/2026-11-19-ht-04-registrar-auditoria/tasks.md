## 1. Base de datos

- [x] 1.1 Crear `prisma/schema/audit.prisma` con el modelo `AuditLog` (tabla `audit_logs`), sus índices y la FK a `User` con `onDelete: Restrict`; agregar `auditLogs AuditLog[]` en `User`
- [x] 1.2 Generar la migración con `--create-only` y añadir la función y el trigger `BEFORE UPDATE OR DELETE` que rechazan los cambios; aplicarla y regenerar el cliente
- [x] 1.3 Verificar contra la base que un `UPDATE` y un `DELETE` sobre `audit_logs` fallan y que un `TRUNCATE` sí funciona

## 2. Módulo de auditoría

- [x] 2.1 Crear `src/modules/audit/audit.catalog.ts` con `AUDIT_ACTIONS`, `AUDIT_MODULES` y los tipos `AuditAction` y `AuditModule`
- [x] 2.2 Crear `AuditService.record(tx, entry)`, que calcula el rol con los roles activos y vigentes del actor (ordenados y separados por coma) y guarda el registro con el mismo `tx`
- [x] 2.3 Crear `AuditModule`, que importa `PrismaModule` y exporta `AuditService`
- [x] 2.4 Pruebas unitarias de `AuditService`: datos guardados, varios roles ordenados, roles vencidos o inactivos excluidos y uso del `tx` recibido

## 3. Acciones de identity

- [x] 3.1 Importar `AuditModule` en `IdentityModule`
- [x] 3.2 Auditar "Registrar" / "Usuarios" dentro de la transacción de `UserRegistrationService`, también cuando se reutiliza una persona existente
- [x] 3.3 Auditar "Registrar" / "Clientes" dentro de la transacción de `ClientRegistrationService`
- [x] 3.4 Auditar "Asignar roles" / "Usuarios" en `UserRoleAssignmentService.update` solo cuando hubo cambios de roles
- [x] 3.5 Actualizar las pruebas de los tres servicios: registro creado en el caso exitoso, ninguno cuando la acción se rechaza y ninguno al guardar los roles sin cambios

## 4. Acciones de pets

- [x] 4.1 Importar `AuditModule` en `PetsModule`
- [x] 4.2 Permitir un cliente de transacción opcional en el `create` de los repositorios de paciente, especie y raza
- [x] 4.3 Pasar `request.user.id` desde los controladores de paciente, especie y raza a `execute`
- [x] 4.4 Envolver el `create` y el `record` en `prisma.$transaction` en los servicios de registro de paciente ("Pacientes"), especie ("Especies") y raza ("Razas")
- [x] 4.5 Actualizar las pruebas de los tres servicios y controladores con el `actorId`, el registro de auditoría y el caso en que falla el `record` y no se guarda la entidad

## 5. Verificación y documentación

- [x] 5.1 Ejecutar `lint`, `build` y todas las pruebas de la API
- [x] 5.2 Probar con la API levantada que registrar un usuario, un cliente, un paciente, una especie y una raza deja su registro, y que una acción rechazada no lo deja
- [x] 5.3 Documentar cómo registrar una acción con `AuditService.record` en `vet-manage-api/docs/identity-rbac.md`, junto a "Proteger una ruta"
- [x] 5.4 Documentar la auditoría en `vet-manage-api/docs/identity-rbac.md`
- [x] 5.5 Crear la e2e `test/identity/audit-log.e2e-spec.ts` contra la base: rechazo de `UPDATE` y `DELETE`, usuario con registros no eliminable, registros conservados al dar de baja, rol guardado ordenado y sin cambios posteriores, y atomicidad
