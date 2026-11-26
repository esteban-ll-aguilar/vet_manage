## Why

En el Módulo 1 (Historial Clínico), el Recepcionista, Gerente o Veterinario necesita inactivar temporalmente a un cliente registrado para impedir que sea seleccionado en nuevas transacciones (como registro de nuevas mascotas o agendamiento de citas), conservando íntegramente sus datos y los historiales clínicos de sus mascotas (**HU-04 · Inactivar un cliente**, issue `#28`, Sprint 2). Además, desbloquea **HU-05** (*Activar un cliente*) y prepara el servicio compartido de cambios de estado de clientes para **HU-03** (*Dar de baja un cliente*).

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/01-clientes.md` (HU-04, RF-04)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (sección 2.2: permiso `clients:inactivate` para Gerente, Veterinario y Recepcionista)
- `docs/modulo-1-historial-clinico/diagramas/clases.md` (sección 4: estados `Activo`, `Inactivo`, `DadoDeBaja` en `Cliente`)

## What Changes

- Crear el servicio `ChangeClientStatusService` en `vet-manage-api/src/modules/clients/services/change-client-status.service.ts` para inactivar un cliente (`ACTIVE` → `INACTIVE`), validando:
  - Existencia del cliente (`404` `"Cliente no encontrado"`).
  - Rechazo si el cliente está dado de baja (`DEACTIVATED`, `400`).
  - Conservación íntegra de los datos de `Person`, `Client` y todos los pacientes (`Patient`) vinculados.
  - Registro atómico en auditoría (`AuditService.record`) dentro de la misma transacción Prisma con acción `Inactivar`, módulo `Clientes`, `affectedRecord` y `previousValue` / `newValue`.
- Exponer `PATCH /api/v1/clients/:clientId/inactivate` en `ClientsController`, protegido con `JwtAuthGuard` y `@RequirePermissions('clients:inactivate')`.
- Importar `AuditModule` en `ClientsModule` y registrar `ChangeClientStatusService`.
- Verificar que un cliente `INACTIVE` sigue siendo consultable junto con sus mascotas (`GET /api/v1/clients`, `GET /api/v1/clients/:clientId/pets`) y es rechazado en nuevas transacciones (por ejemplo `RegisterPatientService` valida `client.status !== 'ACTIVE'`).
- Actualizar `vet-manage-frontend/src/modules/clients/pages/clients-page.tsx`, `clients-page.css` y `clients-api.ts` para incorporar:
  - Acción **Inactivar** (botón de icono con tooltip, visible solo con `clients:inactivate` y para clientes en estado `ACTIVE`).
  - Modal de confirmación elegante con transición visual `Activo → Inactivo`, botón `"Cancelar"` (conserva estado `Activo`) y botón `"Confirmar"`.
  - Badges de estado diferenciados (`Activo` verde, `Inactivo` rojo coral, `De baja` gris pizarra) y avisos de confirmación/error.
- Añadir pruebas unitarias de backend (`change-client-status.service.spec.ts`, `clients.controller.spec.ts`) y frontend (`clients-api.test.ts`, `clients-page.test.tsx`).

## Capabilities

### New Capabilities
- `client-inactivation`: Inactivación temporal de clientes en el backend (`PATCH /api/v1/clients/:clientId/inactivate`), validaciones de estado, protección con permiso `clients:inactivate`, conservación de datos e historiales y restricción de clientes inactivos en nuevas transacciones.
- `client-inactivation-ui`: Interfaz en el listado de clientes (`ClientsPage`) para inactivar clientes activos con modal de confirmación/cancelación, visibilidad controlada por `clients:inactivate` y mensajes de estado/error.

### Modified Capabilities
- `audit-log`: Registrar atómicamente la acción `"Inactivar"` en el módulo `"Clientes"` con `previousValue` y `newValue` al inactivar un cliente.

## Impact

- **Backend (`vet-manage-api`)**:
  - `src/modules/clients/services/change-client-status.service.ts` y `change-client-status.service.spec.ts` (nuevos).
  - `src/modules/clients/routes/clients.controller.ts` y `clients.controller.spec.ts`.
  - `src/modules/clients/clients.module.ts` (importar `AuditModule` y registrar `ChangeClientStatusService`).
  - No requiere cambios en el esquema Prisma (`Client.status` ya usa `RecordStatus`) ni en `audit.catalog.ts` (`inactivate: 'Inactivar'` y `clients: 'Clientes'` ya existen).
- **Frontend (`vet-manage-frontend`)**:
  - `src/modules/clients/types.ts`, `services/clients-api.ts` y `clients-api.test.ts`.
  - `src/modules/clients/pages/clients-page.tsx`, `clients-page.css` y `clients-page.test.tsx`.
