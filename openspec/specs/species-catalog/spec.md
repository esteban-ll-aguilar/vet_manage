## Purpose

Catálogo de especies animales del Módulo 1 (Historial Clínico): permite registrar especies con nombre único y descripción opcional para clasificar a los pacientes.

## Requirements

### Requirement: Registro de nueva especie animal
El sistema SHALL permitir al usuario con permisos de gestión clínica (Veterinario o Administrador con permiso `species:create`) registrar una nueva especie animal en el catálogo del sistema.

#### Scenario: Registro exitoso de una especie con datos completos
- **WHEN** el usuario autenticado con permiso `species:create` envía una solicitud de registro con un nombre válido (ej. "Canino") y una descripción (ej. "Perros domésticos y silvestres")
- **THEN** el sistema registra la especie en la base de datos con un identificador UUID, estado activo por defecto (`isActive: true`), timestamps de creación/actualización y responde con HTTP 201 y el recurso creado en el envelope estándar.

#### Scenario: Registro exitoso de una especie sin descripción
- **WHEN** el usuario autenticado con permiso `species:create` envía una solicitud con nombre válido pero omitiendo el campo de descripción (o enviándolo vacío)
- **THEN** el sistema SHALL aceptar la solicitud, registrar la especie con descripción nula/vacía y retornar HTTP 201 y la especie registrada.

### Requirement: Validación de datos de especie
El sistema SHALL validar los campos requeridos y restricciones de integridad en el registro de especies.

#### Scenario: Validación de nombre obligatorio
- **WHEN** el usuario intenta registrar una especie con el campo de nombre vacío, nulo o compuesto únicamente de espacios en blanco
- **THEN** el sistema SHALL rechazar la solicitud con código de error HTTP 400 (Bad Request), detallando que el nombre es obligatorio.

#### Scenario: Validación de unicidad de nombre de especie
- **WHEN** el usuario intenta registrar una especie cuyo nombre (insensible a mayúsculas/minúsculas) ya existe en el catálogo
- **THEN** el sistema SHALL rechazar la operación con un error HTTP 409 (Conflict) indicando que ya existe una especie registrada con ese nombre.

### Requirement: Control de acceso para registro de especies
El sistema SHALL exigir autenticación y el permiso correspondiente para la creación de especies.

#### Scenario: Intento de registro sin autenticación
- **WHEN** un cliente no autenticado realiza una petición de registro a `POST /api/v1/pets/species`
- **THEN** el sistema SHALL responder con código HTTP 401 (Unauthorized).

#### Scenario: Intento de registro sin permisos requeridos
- **WHEN** un usuario autenticado sin el permiso `species:create` realiza una petición a `POST /api/v1/pets/species`
- **THEN** el sistema SHALL responder con código HTTP 403 (Forbidden).

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
