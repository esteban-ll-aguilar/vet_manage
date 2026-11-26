## ADDED Requirements

### Requirement: Actualización de especie animal existente
El sistema SHALL permitir al usuario autenticado con permiso `species:update` actualizar el nombre y la descripción opcional de una especie registrada mediante `PATCH /api/v1/pets/species/:id`.

#### Scenario: Actualización exitosa de una especie
- **WHEN** un Veterinario autenticado con permiso `species:update` envía `PATCH /api/v1/pets/species/:id` con un nombre válido y una descripción actualizada
- **THEN** el sistema actualiza la especie en la base de datos y responde HTTP `200` con la especie actualizada y mensaje `"Especie actualizada exitosamente"`

#### Scenario: Actualización exitosa sin descripción
- **WHEN** el Veterinario envía `PATCH /api/v1/pets/species/:id` con un nombre válido y el campo descripción vacío u omitido
- **THEN** el sistema permite la actualización guardando `description: null` y responde HTTP `200`

#### Scenario: Validación de nombre obligatorio en actualización
- **WHEN** el Veterinario intenta actualizar una especie eliminando el nombre (vacío o solo espacios)
- **THEN** el sistema rechaza la solicitud con HTTP `400` indicando `"El nombre de la especie es obligatorio"`

#### Scenario: Validación de unicidad al renombrar especie
- **WHEN** el Veterinario intenta renombrar una especie con un nombre que ya pertenece a otra especie registrada (insensible a mayúsculas/minúsculas)
- **THEN** el sistema rechaza la solicitud con HTTP `409` indicando que ya existe una especie con ese nombre

#### Scenario: Especie inexistente
- **WHEN** el Veterinario envía `PATCH /api/v1/pets/species/:id` para un UUID inexistente
- **THEN** el sistema responde HTTP `404` con `"Especie no encontrada"`

#### Scenario: Control de acceso para actualización de especies
- **WHEN** un usuario autenticado sin el permiso `species:update` envía `PATCH /api/v1/pets/species/:id`
- **THEN** el sistema responde HTTP `403` con `"No tiene permisos para realizar esta acción"`

### Requirement: Listado general de especies registradas
El sistema SHALL permitir al usuario autenticado con permiso `species:read` consultar el listado de especies registradas mediante `GET /api/v1/pets/species`.

#### Scenario: Consulta de listado de especies
- **WHEN** un usuario con permiso `species:read` solicita `GET /api/v1/pets/species`
- **THEN** el sistema devuelve HTTP `200` con las especies ordenadas alfabéticamente por nombre, incluyendo `id`, `name`, `description` e `isActive`
