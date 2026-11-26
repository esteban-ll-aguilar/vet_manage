## Purpose

Catálogo de razas del Módulo 1 (Historial Clínico): permite registrar razas asociadas a una especie activa para clasificar a los pacientes con precisión.
## Requirements
### Requirement: Registro de nueva raza
El sistema SHALL permitir a un usuario autenticado con el permiso `breeds:create` (Veterinario o Administrador) registrar una raza asociada a una especie activa, con nombre obligatorio y descripción opcional.

#### Scenario: Registro exitoso de una raza con datos completos
- **WHEN** el usuario con permiso `breeds:create` envía `POST /api/v1/pets/breeds` con un nombre válido (ej. "Labrador"), el identificador de una especie activa y una descripción
- **THEN** el sistema registra la raza asociada a esa especie con identificador UUID y estado activo por defecto, y responde HTTP 201 con la raza creada en el envelope estándar y el mensaje «Raza registrada exitosamente»

#### Scenario: Registro exitoso sin descripción
- **WHEN** el usuario envía un nombre válido y una especie activa, omitiendo la descripción o enviándola vacía
- **THEN** el sistema registra la raza con descripción nula y responde HTTP 201

#### Scenario: Descripción demasiado larga
- **WHEN** el usuario envía una descripción de más de 500 caracteres
- **THEN** el sistema responde HTTP 400 indicando que la descripción no puede exceder los 500 caracteres y no guarda nada

#### Scenario: Nombre con espacios sobrantes
- **WHEN** el usuario envía el nombre "  Labrador  "
- **THEN** el sistema guarda el nombre recortado "Labrador"

### Requirement: Validación de datos de raza
El sistema SHALL rechazar el registro de una raza cuando falten datos obligatorios o se incumplan las reglas de integridad del catálogo.

#### Scenario: Nombre obligatorio
- **WHEN** el usuario intenta registrar una raza con nombre vacío, nulo o solo con espacios
- **THEN** el sistema responde HTTP 400 indicando que el nombre de la raza es obligatorio y no guarda nada

#### Scenario: Especie obligatoria
- **WHEN** el usuario intenta registrar una raza sin especie, o con un identificador de especie que no tiene formato UUID
- **THEN** el sistema responde HTTP 400 indicando que la raza debe asociarse a una especie y no guarda nada

#### Scenario: Especie inexistente
- **WHEN** el usuario envía un identificador de especie con formato válido que no corresponde a ninguna especie registrada
- **THEN** el sistema responde HTTP 404 indicando que la especie seleccionada no existe

#### Scenario: Especie inactiva
- **WHEN** el usuario envía el identificador de una especie con estado inactivo
- **THEN** el sistema responde HTTP 409 indicando que la especie seleccionada está inactiva y no guarda la raza

#### Scenario: Nombre duplicado dentro de la misma especie
- **WHEN** el usuario intenta registrar una raza cuyo nombre, sin distinguir mayúsculas ni minúsculas, ya existe en la misma especie
- **THEN** el sistema responde HTTP 409 indicando que ya existe una raza con ese nombre para la especie

#### Scenario: Mismo nombre en otra especie
- **WHEN** el usuario registra una raza cuyo nombre ya existe, pero en una especie distinta
- **THEN** el sistema permite el registro y responde HTTP 201

### Requirement: Especies activas disponibles para asociación
El sistema SHALL ofrecer, a usuarios autenticados con el permiso `species:read`, la lista de especies con estado activo para asociarlas a una raza, y SHALL excluir las especies inactivas.

#### Scenario: Consulta de especies activas
- **WHEN** el usuario con permiso `species:read` solicita `GET /api/v1/pets/species/active`
- **THEN** el sistema responde HTTP 200 con las especies activas (identificador y nombre) ordenadas alfabéticamente por nombre, sin incluir especies inactivas

#### Scenario: No hay especies activas
- **WHEN** no existe ninguna especie activa y el usuario consulta las especies activas
- **THEN** el sistema responde HTTP 200 con una lista vacía

### Requirement: Formulario de registro de raza
La interfaz SHALL ofrecer, desde la pestaña «Razas» de Catálogos, un formulario de registro de raza con nombre obligatorio, selector de especie obligatorio limitado a especies activas, descripción opcional y las acciones «Guardar» y «Cancelar».

#### Scenario: Registro exitoso desde la interfaz
- **WHEN** el Veterinario completa el nombre, selecciona una especie activa y pulsa «Guardar»
- **THEN** la interfaz envía el registro, cierra el formulario y muestra un mensaje de confirmación

#### Scenario: Guardar sin nombre
- **WHEN** el Veterinario pulsa «Guardar» sin ingresar el nombre
- **THEN** la interfaz no envía la solicitud y muestra que el nombre de la raza es obligatorio

#### Scenario: Guardar sin especie
- **WHEN** el Veterinario pulsa «Guardar» sin seleccionar una especie
- **THEN** la interfaz no envía la solicitud y muestra que la raza debe asociarse a una especie

#### Scenario: Solo especies activas en el selector
- **WHEN** el Veterinario abre el formulario de registro de raza
- **THEN** el selector de especie muestra únicamente las especies con estado activo

#### Scenario: Sin especies activas
- **WHEN** el Veterinario abre el formulario y no hay especies activas
- **THEN** la interfaz informa que primero debe registrarse o activarse una especie y no permite guardar

#### Scenario: Cancelación del registro
- **WHEN** el Veterinario ingresó datos y pulsa «Cancelar»
- **THEN** la interfaz cierra el formulario sin enviar ni guardar la información

### Requirement: Control de acceso al catálogo de razas
El sistema SHALL exigir autenticación y el permiso correspondiente para registrar razas y para consultar las especies activas.

#### Scenario: Registro sin autenticación
- **WHEN** un cliente no autenticado llama a `POST /api/v1/pets/breeds` o a `GET /api/v1/pets/species/active`
- **THEN** el sistema responde HTTP 401

#### Scenario: Registro sin permiso
- **WHEN** un usuario autenticado sin el permiso `breeds:create` llama a `POST /api/v1/pets/breeds`
- **THEN** el sistema responde HTTP 403 y no guarda la raza

### Requirement: Consulta de razas activas por especie
El sistema SHALL permitir a un usuario autenticado con el permiso `breeds:read` consultar las razas activas de una especie, para poblar selectores como el del registro de pacientes.

#### Scenario: Razas activas de una especie
- **WHEN** el usuario con permiso `breeds:read` envía `GET /api/v1/pets/species/:speciesId/breeds` con el identificador de una especie existente
- **THEN** el sistema responde HTTP 200 con la lista `[{ id, name }]` de las razas activas de esa especie, ordenada por nombre, sin incluir razas inactivas ni de otras especies

#### Scenario: Especie sin razas activas
- **WHEN** la especie existe pero no tiene razas activas
- **THEN** el sistema responde HTTP 200 con una lista vacía

#### Scenario: Identificador de especie inválido
- **WHEN** el `speciesId` no tiene formato UUID
- **THEN** el sistema responde HTTP 400

#### Scenario: Usuario sin permiso
- **WHEN** un usuario autenticado sin el permiso `breeds:read` consulta el endpoint
- **THEN** el sistema responde HTTP 403

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

