## Context

- `Species` tiene `isActive` (por defecto `true`). `SpeciesController` (`/pets/species`) ya expone:
  - el listado completo (`species:read`), que la pantalla usa y que muestra la columna «Estado»;
  - el listado de activas (`/pets/species/active`);
  - el registro (`species:create`) y la actualización (`species:update`).
- El permiso `species:change-status` ya existe y solo lo tiene el Veterinario (`roles.catalog.ts`, `catalogManagement('species')`).
- Las especies inactivas ya quedan fuera de las nuevas transacciones:
  - `RegisterBreedService` rechaza registrar una raza en una especie inactiva;
  - `UpdateBreedService` rechaza mover una raza a una especie inactiva;
  - `RegisterPatientService` responde 409 «La especie seleccionada no está disponible»;
  - los formularios de raza y de paciente cargan las especies desde `/pets/species/active`.
- La auditoría ya tiene `AUDIT_ACTIONS.activate`, `AUDIT_ACTIONS.inactivate` y `AUDIT_MODULES.species`. `UpdateSpeciesService` audita con `affectedRecord` igual al nombre de la especie.
- `SpeciesPage` muestra la tabla con el botón «Editar» (`species:update`) y un modal para registrar y editar. Usa toasts para los resultados.

## Goals / Non-Goals

**Goals:**
- Activar e inactivar una especie desde la API y desde la pantalla, con confirmación, auditoría y control por permiso.
- Conservar las razas y los pacientes de la especie al inactivarla (riesgo R-07).

**Non-Goals:**
- Inactivar en cascada las razas o los pacientes de la especie, o impedir inactivarla si los tiene. Siguen como están y conservan su historial; solo dejan de poder crearse registros nuevos con esa especie.
- Activar o inactivar razas (HU-19).
- Cambiar los formularios de razas o de pacientes: ya cargan solo especies activas.

## Decisions

### 1. Un endpoint de estado: `PATCH /pets/species/:id/status`
El cuerpo es `{ isActive: boolean }` y el permiso es `species:change-status`. Un solo permiso cubre las dos acciones, igual que `users:change-status` con `PATCH /users/:id/status` (HU-55), así que no hace falta separar la ruta. Se descartaron `/activate` e `/inactivate`, como en clientes, porque allí cada acción tiene su propio permiso.

`ChangeSpeciesStatusDto` valida con `@IsBoolean({ message: 'Estado de especie no válido' })`. Un `isActive` que falta o no es booleano responde 400 antes de llegar al servicio.

### 2. `ChangeSpeciesStatusService` (un servicio por operación)
Está en `services/species/change-species-status.service.ts`. Su método es `execute(id, isActive, actorId)`:
1. si la especie no existe → 404 «Especie no encontrada»;
2. si ya está en el estado pedido → devuelve la especie sin escribir ni auditar (idempotente);
3. si no, actualiza `isActive` y audita, en la misma transacción.

Devuelve `{ message, species }`, con la especie completa para que la pantalla pueda actualizar la fila, incluido `updatedAt`. Los mensajes van en `SPECIES_STATUS_MESSAGES`:
- `inactivated: 'Especie inactivada correctamente'`
- `activated: 'Especie activada correctamente'`
- `notFound: 'Especie no encontrada'`

`SpeciesRepository` gana `updateStatus(id, isActive, tx?)`, siguiendo el patrón de `update`. La especie se lee con `tx.species.findUnique` dentro de la misma transacción, y no con `SpeciesRepository.findById`, que no recibe `tx`. Así la lectura y la escritura no pueden mezclar dos estados si otro usuario cambia la especie al mismo tiempo.

### 3. Auditoría
- La acción es `AUDIT_ACTIONS.inactivate` o `AUDIT_ACTIONS.activate` y el módulo es `AUDIT_MODULES.species`.
- `affectedRecord` es el nombre de la especie, como en `UpdateSpeciesService`.
- Se guardan `previousValue: { status: 'Activa' | 'Inactiva' }` y `newValue` con el estado nuevo.

### 4. Pantalla
- `speciesApi.changeStatus(id, isActive)` llama a `PATCH /pets/species/:id/status`.
- `canChangeStatus = hasPermission('species:change-status')`. La columna «Acciones» aparece con `canUpdate` o con `canChangeStatus`, y cada botón aparece según su permiso.
- Junto a «Editar» va un botón de icono: «Inactivar {nombre}» (rojo) en las especies activas o «Activar {nombre}» (verde) en las inactivas.
- Un diálogo de confirmación (`pendingStatus = { species, isActive }`):
  - título «Inactivar especie» o «Activar especie»;
  - el nombre de la especie y la transición `Activa → Inactiva` o `Inactiva → Activa`;
  - un texto según la acción. Al inactivar dice que la especie no se podrá elegir al registrar razas ni pacientes, y que los existentes se conservan. Al activar dice que vuelve a estar disponible;
  - «Confirmar» y «Cancelar». Los dos se deshabilitan mientras se guarda, y Escape o el fondo cierran el diálogo, salvo mientras guarda.
- Al confirmar, se reemplaza la fila con la especie devuelta y se muestra el toast de éxito. Si falla, se muestra un toast de error con el mensaje de la API y la fila no cambia.

## Risks / Trade-offs

- **[R-07: inactivar una especie con razas o pacientes]** → No se tocan sus razas ni sus pacientes. Los servicios de raza y de paciente ya rechazan las especies inactivas. La e2e comprueba que, tras inactivar, la especie desaparece de `/pets/species/active` y no se pueden registrar razas en ella, y que al activarla vuelve.
- **[La pantalla y la API pueden desfasarse si otro usuario cambia el estado]** → El servicio es idempotente y la fila se reemplaza con lo que devuelve la API, así que siempre muestra el estado real.
- **[Archivos de HU-13 y HU-14 de otro integrante (`species.controller.ts`, `species.repository.ts`, `species-page.tsx`)]** → Solo se agregan una ruta, un método y la acción nueva, sin cambiar lo existente. Hay que avisar al responsable en el PR.

## Cómo probar

- Sin variables de entorno nuevas ni migraciones. Arranque con `make up`.
- API: `http://localhost:3080/api/v1/pets/species/:id/status`. Frontend: `http://localhost:5174`, pantalla de especies, entrando como Veterinario.
- e2e: `docker exec vet-manage-api-1 sh -c "npx vitest run --config vitest.config.e2e.ts test/pets/species-status.e2e-spec.ts"`. Hay que reiniciar el contenedor de la API (`docker restart vet-manage-api-1`) después de agregar la ruta.
