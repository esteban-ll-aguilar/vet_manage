## Context

- HU-04 dejó `ChangeClientStatusService` (`clients/services/change-client-status.service.ts`) con `inactivate`, y la ruta `PATCH /clients/:clientId/inactivate` con `clients:inactivate`. Su diseño previó que HU-05 agregara `activate` en el mismo servicio y en una ruta propia, `/activate`.
- `ClientStatus` tiene `ACTIVE`, `INACTIVE` y `DEACTIVATED`. Dar de baja (HU-03) aún no está implementado, pero puede haber clientes `DEACTIVATED` en la base.
- `clients:activate` ya existe y está asignado al Gerente, al Veterinario y al Recepcionista (`roles.catalog.ts`). `AUDIT_ACTIONS.activate` (`'Activar'`) ya existe.
- El registro de pacientes rechaza a los clientes no activos con «El cliente seleccionado no está disponible» (`register-patient.service.ts`). Activar al cliente basta para que vuelva a elegirse.
- `ClientsPage` muestra «Inactivar» en los clientes activos, con un diálogo de confirmación (`pendingClient`) y toasts de éxito y error.

## Goals / Non-Goals

**Goals:**
- Activar un cliente inactivo desde la API y desde el listado, con confirmación, auditoría y control por permiso.
- No permitir activar a un cliente dado de baja (riesgo R-05).
- Reutilizar el servicio, el diálogo y los estilos de HU-04 sin cambiar su comportamiento.

**Non-Goals:**
- Dar de baja a un cliente (HU-03).
- Cambiar el registro de pacientes u otros módulos: ya aceptan a los clientes activos.
- Una ficha de detalle del cliente: la acción vive en el listado, como «Inactivar».

## Decisions

### 1. `activate` en `ChangeClientStatusService`
Se agrega `activate(clientId, actorId)` junto a `inactivate`, en la misma transacción y con el mismo orden de comprobaciones:
1. si el cliente no existe → 404 «Cliente no encontrado»;
2. si está `DEACTIVATED` → 400 `CLIENT_STATUS_DEACTIVATED` «No se puede activar un cliente dado de baja»;
3. si ya está `ACTIVE` → responde con éxito sin escribir ni auditar (idempotente, como `inactivate`);
4. si no, pasa a `ACTIVE` y audita.

La lectura y la escritura comunes se pueden extraer a un método privado, siempre que `inactivate` siga respondiendo igual. La alternativa, un servicio aparte, se descartó porque HU-04 dejó el servicio preparado para esto.

Mensajes en `CLIENT_STATUS_MESSAGES`: `activated: 'Cliente activado correctamente'` y `activateDeactivated: 'No se puede activar un cliente dado de baja'`. El mensaje de inactivar no cambia.

### 2. Ruta propia `PATCH /clients/:clientId/activate`
Con `@RequirePermissions('clients:activate')` y `ParseUUIDPipe`, como `/inactivate`. Responde `success({ id, status: 'ACTIVE' }, message)`. Un único endpoint de estado con el estado en el cuerpo obligaría a revisar el permiso dentro del servicio. Se descartó por eso.

### 3. Auditoría
`AUDIT_ACTIONS.activate`, `AUDIT_MODULES.clients`, `describePerson(client.person)`, `previousValue: { status: 'Inactivo' }`, `newValue: { status: 'Activo' }`. El registro de auditoría guarda la fecha y el usuario: así se cumple «registrar la fecha y el usuario responsable de la activación». No hace falta agregar columnas a `clients`.

### 4. Pantalla
- `clientsApi.activate(clientId)` y el tipo `ActivatedClient`.
- `canActivate = hasPermission('clients:activate')`; la columna de acciones aparece si hay alguno de `canUpdate`, `canInactivate` o `canActivate`.
- Botón «Activar» (icono verde) solo en las filas `INACTIVE`. Los clientes `DEACTIVATED` no muestran ni «Activar» ni «Inactivar».
- `pendingClient` pasa a `pendingAction = { client, targetStatus }`, y un solo diálogo cambia según la acción:
  - inactivar: título «Inactivar cliente», `Activo → Inactivo` y el texto actual;
  - activar: título «Activar cliente», `Inactivo → Activo` y un texto que dice que el cliente vuelve a estar disponible y conserva sus datos e historiales.
- Al confirmar: se actualiza la fila (o se recarga la lista si hay un filtro de estado) y se muestra el toast «Cliente activado correctamente». Si falla, se muestra un toast de error con el mensaje de la API y la fila no cambia.

## Risks / Trade-offs

- **[Riesgo R-05: reactivar un cliente dado de baja]** → La API lo rechaza aunque alguien llame directamente al endpoint, y la pantalla no muestra «Activar» en esos clientes. Lo cubren pruebas unitarias y e2e.
- **[Conflicto con HU-03 en el mismo servicio]** → `activate` va en su propio método y su propia ruta; HU-03 agregará `deactivate` sin tocarlos.
- **[La historia nombra solo al Recepcionista y al Gerente, pero la matriz incluye al Veterinario]** → Se sigue la matriz, que es la que define los permisos (`roles.catalog.ts`), igual que en HU-04. No se cambian los roles.

## Cómo probar

- Sin variables de entorno nuevas ni migraciones. Arranque con `make up`.
- API: `http://localhost:3080/api/v1/clients/:clientId/activate`. Frontend: `http://localhost:5174/clients`.
- e2e: `docker exec vet-manage-api-1 sh -c "npx vitest run --config vitest.config.e2e.ts test/clients/client-activation.e2e-spec.ts"`. Hay que reiniciar el contenedor de la API (`docker restart vet-manage-api-1`) después de agregar la ruta.
