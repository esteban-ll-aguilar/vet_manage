## 1. Servicio y DTO (API)

- [x] 1.1 Crear `dtos/species/change-species-status.dto.ts` con `isActive` validado por `@IsBoolean({ message: 'Estado de especie no válido' })`.
- [x] 1.2 Agregar `SpeciesRepository.updateStatus(id, isActive, tx?)`.
- [x] 1.3 Crear `services/species/change-species-status.service.ts`, con `SPECIES_STATUS_MESSAGES` y `execute(id, isActive, actorId)`:
  - 404 si la especie no existe;
  - sin escritura ni auditoría si ya está en ese estado;
  - si no, actualiza y audita (`Inactivar`/`Activar`, `Especies`, nombre, `Activa ↔ Inactiva`) en la misma transacción;
  - devuelve `{ message, species }`.
- [x] 1.4 Pruebas unitarias en `change-species-status.service.spec.ts`: inactivar, activar, idempotencia en los dos sentidos, 404 y contenido de la auditoría.

## 2. Ruta (API)

- [x] 2.1 Agregar `PATCH /pets/species/:id/status` en `species.controller.ts` con `JwtAuthGuard`, `PermissionsGuard`, `@RequirePermissions('species:change-status')`, `ParseUUIDPipe` y `success(species, message)`, y registrar el servicio en `pets.module.ts`.
- [x] 2.2 Pruebas del controlador: el permiso `species:change-status`, la delegación al servicio con el usuario y el 401 sin usuario.

## 3. Pruebas e2e

- [x] 3.1 Crear `test/pets/species-status.e2e-spec.ts` con base de datos real:
  - inactivar y activar con auditoría, y la idempotencia sin auditoría;
  - 404, UUID inválido, `isActive` inválido o ausente (400) y 401;
  - 403 para el Gerente, el Técnico Veterinario y el Recepcionista;
  - tras inactivar, la especie sale de `/pets/species/active`, se rechaza registrar una raza en ella, y sus razas y pacientes existentes se conservan sin cambios;
  - tras activarla, vuelve a `/pets/species/active` para el Veterinario, el Técnico Veterinario y el Recepcionista, y se puede registrar una raza.

## 4. Frontend

- [x] 4.1 Agregar `speciesApi.changeStatus(id, isActive)` (`PATCH /pets/species/:id/status`) con su prueba.
- [x] 4.2 En `species-page.tsx`:
  - agregar `canChangeStatus` (`species:change-status`) y mostrar la columna de acciones con cualquiera de los dos permisos;
  - mostrar «Inactivar {nombre}» en las especies activas y «Activar {nombre}» en las inactivas.
- [x] 4.3 Agregar el diálogo de confirmación (`pendingStatus`):
  - título, nombre, transición y texto según la acción, con «Confirmar» y «Cancelar»;
  - botones deshabilitados mientras guarda;
  - Escape y el fondo cierran el diálogo, salvo mientras guarda.
- [x] 4.4 Al confirmar, reemplazar la fila con la especie devuelta y mostrar el toast de éxito; si falla, mostrar un toast de error sin cambiar la fila.
- [x] 4.5 Pruebas en `species-page.test.tsx`:
  - acciones según el estado y el permiso, y la columna solo con el permiso de estado;
  - confirmar inactivar y activar, con la API, la fila y el toast;
  - cancelar con el botón, con Escape o con clic fuera, sin llamar a la API;
  - botones deshabilitados mientras guarda;
  - error en un toast.

## 5. Verificación

- [x] 5.1 Ejecutar las pruebas unitarias de la API y del frontend, tsc y oxlint, y la e2e en el contenedor.
- [x] 5.2 Probar en el navegador como Veterinario: inactivar, cancelar, activar, y comprobar que la especie inactiva no aparece al registrar una raza.
