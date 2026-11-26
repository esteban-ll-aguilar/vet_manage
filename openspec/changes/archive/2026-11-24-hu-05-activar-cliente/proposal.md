## Why

Con HU-04 un cliente se puede inactivar, pero no hay forma de volver a activarlo: queda bloqueado para registrar pacientes y para otras transacciones aunque vuelva a necesitar atención. HU-05 «Activar un cliente» (SP-02, issue Axlmd16/vet_manage#33, depende de HU-04) lo resuelve sin perder sus datos ni sus historiales, y cuida el riesgo R-05: que un cliente dado de baja se reactive por error.

## What Changes

- **API**: `PATCH /api/v1/clients/:clientId/activate`, protegido con el permiso `clients:activate`, que ya existe en el catálogo de roles:
  - pasa un cliente `INACTIVE` a `ACTIVE` y responde `"Cliente activado correctamente"`;
  - si el cliente ya está activo, responde lo mismo sin repetir la auditoría;
  - rechaza un cliente dado de baja (`DEACTIVATED`) con 400 y `"No se puede activar un cliente dado de baja"`, y uno que no existe con 404;
  - registra en la auditoría la fecha y el usuario responsable (`Activar` / `Clientes`, `Inactivo → Activo`).
- **Pantalla de clientes**:
  - botón «Activar» en los clientes inactivos, solo con el permiso `clients:activate`; no aparece en los clientes activos ni en los dados de baja;
  - diálogo de confirmación con el nombre, el correo y la transición `Inactivo → Activo`, con «Confirmar» y «Cancelar»;
  - el resultado se muestra en un toast, como en la inactivación (HU-04).
- Un cliente activado vuelve a poder elegirse en el registro de pacientes, porque ese registro ya solo exige que el cliente esté activo. No se cambia nada en `pets`.

## Capabilities

### New Capabilities
- `client-activation`: activación de un cliente inactivo en la API: transición permitida, rechazos, auditoría, permiso y disponibilidad del cliente en nuevas transacciones.
- `client-activation-ui`: acción «Activar» en el listado de clientes, con confirmación, toasts y control por permiso.

### Modified Capabilities
<!-- Ninguna: la inactivación (HU-04) no cambia sus requisitos. -->

## Impact

- **Backend** (`vet-manage-api/src/modules/clients/`):
  - `services/change-client-status.service.ts`: se agrega `activate` junto a `inactivate`, en el mismo servicio, como dejó previsto HU-04;
  - `routes/clients.controller.ts`: nueva ruta `/activate`;
  - pruebas unitarias y una e2e nueva, `test/clients/client-activation.e2e-spec.ts`.
- **Permisos**: no cambian. `clients:activate` ya lo tienen el Gerente, el Veterinario y el Recepcionista en `roles.catalog.ts`, como indica la matriz de roles. La historia nombra solo al Recepcionista y al Gerente; se sigue la matriz, igual que en HU-04.
- **Base de datos**: sin migraciones; se usa el estado `ClientStatus` existente.
- **Frontend** (`vet-manage-frontend/src/modules/clients/`): `clientsApi.activate`, el botón y el diálogo en `clients-page.tsx`, y sus pruebas.
- **Compartidos**: no se tocan `common/` ni `infrastructure/`; `AUDIT_ACTIONS.activate` ya existe.
