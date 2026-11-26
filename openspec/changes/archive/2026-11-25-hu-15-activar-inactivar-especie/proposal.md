## Why

El Veterinario puede registrar (HU-13) y actualizar (HU-14) especies, pero no puede retirar del catálogo una especie que la clínica ya no atiende, ni devolverla después. La columna «Estado» existe, pero toda especie queda «Activa» para siempre. HU-15 «Activar e inactivar especie» (SP-02, issue Axlmd16/vet_manage#34, depende de HU-13) lo resuelve. También cuida el riesgo R-07: que el catálogo quede inconsistente al inactivar una especie que ya tiene razas o pacientes.

## What Changes

- **API**: `PATCH /api/v1/pets/species/:id/status` con `{ isActive: boolean }`, protegido con el permiso `species:change-status`, que ya existe y solo tiene el Veterinario:
  - inactiva una especie activa («Especie inactivada correctamente») o activa una inactiva («Especie activada correctamente»);
  - si la especie ya está en ese estado, responde lo mismo sin repetir la auditoría;
  - rechaza una especie que no existe (404) y un estado que no sea booleano (400);
  - registra en la auditoría quién y cuándo (`Inactivar` o `Activar` / `Especies`, `Activa ↔ Inactiva`).
- **Pantalla de especies**:
  - botón «Inactivar» en las especies activas y «Activar» en las inactivas, solo con `species:change-status`;
  - diálogo de confirmación con el nombre y la transición, con «Confirmar» y «Cancelar»;
  - el resultado se muestra en un toast y la fila cambia de estado sin recargar.
- **R-07**: inactivar no borra ni cambia las razas ni los pacientes de la especie. Una especie inactiva deja de ofrecerse al registrar razas y pacientes, porque esos formularios y servicios ya usan solo especies activas. Al activarla vuelve a ofrecerse (escenario 4). No se cambia nada en razas ni en pacientes.

## Capabilities

### New Capabilities
- `species-status`: cambio de estado de una especie en la API: transiciones, rechazos, auditoría, permiso y efecto en el catálogo de especies activas.
- `species-status-ui`: acciones «Activar» e «Inactivar» en la pantalla de especies, con confirmación, toasts y control por permiso.

### Modified Capabilities
<!-- Ninguna: el registro, la actualización y la consulta de especies no cambian sus requisitos. -->

## Impact

- **Backend** (`vet-manage-api/src/modules/pets/`):
  - nuevo `services/species/change-species-status.service.ts` (un servicio por operación) y `dtos/species/change-species-status.dto.ts`;
  - `repositories/species.repository.ts`: método para cambiar el estado dentro de una transacción;
  - `routes/species.controller.ts`: nueva ruta `/status`;
  - pruebas unitarias y una e2e nueva, `test/pets/species-status.e2e-spec.ts`.
- **Permisos**: no cambian. `species:change-status` ya está en `roles.catalog.ts` solo para el Veterinario, como indica la matriz de roles (sección 2.4).
- **Base de datos**: sin migraciones; se usa la columna `is_active` de `species`.
- **Frontend** (`vet-manage-frontend/src/modules/pets/`): `speciesApi.changeStatus`, los botones y el diálogo en `species-page.tsx`, y sus pruebas.
- **Compartidos**: no se tocan `common/` ni `infrastructure/`; `AUDIT_ACTIONS.activate`, `AUDIT_ACTIONS.inactivate` y `AUDIT_MODULES.species` ya existen.
