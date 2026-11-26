## ADDED Requirements

### Requirement: Actualización de raza registrada
El sistema SHALL permitir al usuario autenticado con permiso `breeds:update` actualizar el nombre, la especie asociada y la descripción opcional de una raza registrada mediante `PATCH /api/v1/pets/breeds/:id`, conservando intactas las historias clínicas de los pacientes asociados.

#### Scenario: Actualización exitosa de una raza
- **WHEN** un Veterinario autenticado con permiso `breeds:update` envía `PATCH /api/v1/pets/breeds/:id` con un nombre válido, una especie activa válida y una descripción actualizada
- **THEN** el sistema actualiza la raza en la base de datos sin alterar los pacientes ni historias clínicas asociados y responde HTTP `200` con la raza actualizada (incluyendo `species: { id, name }`) y mensaje `"Raza actualizada exitosamente"`

#### Scenario: Actualización exitosa sin descripción
- **WHEN** el Veterinario envía `PATCH /api/v1/pets/breeds/:id` con nombre y especie válidos y el campo descripción vacío u omitido
- **THEN** el sistema permite la actualización guardando `description: null` y responde HTTP `200`

#### Scenario: Validación de nombre obligatorio en actualización
- **WHEN** el Veterinario intenta actualizar una raza eliminando el nombre (vacío o solo espacios)
- **THEN** el sistema rechaza la solicitud con HTTP `400` indicando `"El nombre de la raza es obligatorio"`

#### Scenario: Validación de especie asociada obligatoria en actualización
- **WHEN** el Veterinario intenta actualizar una raza sin especie asociada o con un `speciesId` sin formato UUID
- **THEN** el sistema rechaza la solicitud con HTTP `400` indicando `"La raza debe asociarse a una especie"`

#### Scenario: Especie destino inexistente o inactiva al reasignar
- **WHEN** el Veterinario envía un `speciesId` que no existe o reasigna la raza a otra especie que está inactiva
- **THEN** el sistema responde HTTP `404` (`"La especie seleccionada no existe"`) o HTTP `409` (`"La especie seleccionada está inactiva"`) respectivamente

#### Scenario: Validación de unicidad de nombre dentro de la especie destino
- **WHEN** el Veterinario intenta actualizar una raza usando un nombre que ya pertenece a otra raza dentro de la misma especie destino (insensible a mayúsculas/minúsculas)
- **THEN** el sistema rechaza la solicitud con HTTP `409` indicando que ya existe una raza con ese nombre para la especie

#### Scenario: Raza inexistente
- **WHEN** el Veterinario envía `PATCH /api/v1/pets/breeds/:id` para un UUID inexistente
- **THEN** el sistema responde HTTP `404` con `"Raza no encontrada"`

#### Scenario: Control de acceso para actualización de razas
- **WHEN** un usuario autenticado sin el permiso `breeds:update` envía `PATCH /api/v1/pets/breeds/:id`
- **THEN** el sistema responde HTTP `403` con `"No tiene permisos para realizar esta acción"`

### Requirement: Listado general de razas registradas
El sistema SHALL permitir al usuario autenticado con permiso `breeds:read` consultar el listado completo de razas registradas mediante `GET /api/v1/pets/breeds`.

#### Scenario: Consulta de listado de razas
- **WHEN** un usuario con permiso `breeds:read` solicita `GET /api/v1/pets/breeds`
- **THEN** el sistema devuelve HTTP `200` con las razas ordenadas alfabéticamente por nombre, incluyendo `id`, `name`, `description`, `isActive`, `speciesId` y `species: { id, name }`
