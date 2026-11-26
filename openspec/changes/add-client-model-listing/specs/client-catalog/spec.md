## ADDED Requirements

### Requirement: Modelo de cliente dedicado
El sistema SHALL mantener una entidad `Client` dedicada en Prisma, relacionada 1:1 con `Person` mediante `personId` único, con `status`, `createdAt` y `updatedAt`.

#### Scenario: Cliente creado a partir de una persona con rol client
- **WHEN** se registra una persona con rol `client` activo a través del flujo de registro de clientes
- **THEN** el sistema debe crear un registro `Client` vinculado a esa persona con estado `ACTIVE`
- **AND** debe hacerlo en la misma transacción en la que se crean la persona y el usuario

#### Scenario: Datos existentes compatible con la nueva entidad
- **WHEN** existen personas con rol `client` activo antes de aplicar la migración
- **THEN** la migración debe crear su registro `Client` correspondiente con estado `ACTIVE`
- **AND** no debe duplicar registros para personas que ya tengan un `Client`

#### Scenario: Persona sin rol client no se convierte en cliente
- **WHEN** una persona tiene un registro `Client` pero su usuario no tiene un rol `client` activo
- **THEN** el sistema no debe devolverla en el listado de clientes
- **AND** debe mantener el registro `Client` sin eliminarlo automáticamente

### Requirement: Listado paginado de clientes
El sistema SHALL exponer `GET /api/v1/clients` para devolver únicamente clientes cuyo usuario tenga un rol `client` activo, excluyendo al personal aunque posea un registro `Client`.

#### Scenario: Listado exitoso de clientes activos
- **WHEN** un usuario con permiso `clients:read` solicita `GET /api/v1/clients`
- **THEN** el sistema debe devolver una respuesta exitosa con los clientes que tienen un rol `client` activo
- **AND** cada item debe incluir `id`, `personId`, `identification`, `firstName`, `lastName`, `email`, `phone`, `address`, `status`, `roles` y `createdAt`
- **AND** la respuesta no debe incluir contraseñas, hashes ni datos de sesión

#### Scenario: Exclusión de personal del listado
- **WHEN** existen personas con roles de personal como `veterinarian`, `receptionist` o `manager`
- **AND** dichas personas no tienen un rol `client` activo
- **THEN** el sistema no debe incluirlas en la respuesta de `GET /api/v1/clients`

#### Scenario: Paginación por defecto
- **WHEN** no se envían parámetros `page` ni `pageSize`
- **THEN** el sistema debe devolver la página `1` con `20` elementos por página
- **AND** debe incluir metadatos con `page`, `pageSize`, `total` y `totalPages`

#### Scenario: Paginación explícita
- **WHEN** se solicita `GET /api/v1/clients?page=2&pageSize=10`
- **THEN** el sistema debe omitir los primeros `10` clientes y devolver como máximo `10` elementos
- **AND** los metadatos deben reflejar `page=2` y `pageSize=10`

#### Scenario: Tamaño de página fuera de rango
- **WHEN** se solicita un `pageSize` mayor que `100`, menor que `1` o no numérico
- **THEN** el sistema debe rechazar la solicitud con estado `400`
- **AND** debe devolver un mensaje de error que indique que `pageSize` debe estar entre `1` y `100`

### Requirement: Búsqueda y filtrado de clientes
El sistema SHALL permitir filtrar el listado de clientes por búsqueda parcial y por estado.

#### Scenario: Búsqueda por cédula
- **WHEN** se envía `search` con parte de la cédula de un cliente
- **THEN** el sistema debe devolver los clientes cuyo `identification` contenga ese valor
- **AND** la comparación debe ser insensible a mayúsculas y minúsculas

#### Scenario: Búsqueda por nombre o apellido
- **WHEN** se envía `search` con parte del nombre o apellido de un cliente
- **THEN** el sistema debe devolver los clientes cuyo `firstName` o `lastName` contengan ese valor
- **AND** la búsqueda debe aplicarse de forma insensible a mayúsculas y minúsculas

#### Scenario: Filtro por estado del cliente
- **WHEN** se envía `status=INACTIVE`
- **THEN** el sistema debe devolver solo clientes cuyo `status` sea `INACTIVE`
- **AND** debe combinar el filtro con `search` y con la paginación cuando estén presentes

#### Scenario: Sin resultados
- **WHEN** ningún cliente coincide con los filtros solicitados
- **THEN** el sistema debe devolver una lista vacía
- **AND** los metadatos deben indicar `total=0` y `totalPages=0`

### Requirement: Control de acceso al listado de clientes
El sistema SHALL proteger `GET /api/v1/clients` con autenticación y el permiso `clients:read` existente.

#### Scenario: Acceso autorizado
- **WHEN** un usuario autenticado con permiso `clients:read` solicita el listado
- **THEN** el sistema debe permitir el acceso y devolver los clientes

#### Scenario: Acceso sin autenticación
- **WHEN** un solicitante sin sesión válida intenta acceder al listado
- **THEN** el sistema debe rechazar la solicitud con estado `401`

#### Scenario: Acceso sin permiso
- **WHEN** un usuario autenticado sin permiso `clients:read` intenta acceder al listado
- **THEN** el sistema debe rechazar la solicitud con estado `403`
