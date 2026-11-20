## ADDED Requirements

### Requirement: Búsqueda exacta por número de cédula
El sistema SHALL permitir a un usuario autenticado con `clients:read` encontrar únicamente la ficha del cliente cuya cédula coincide exactamente con los 10 dígitos ingresados, con un tiempo máximo de respuesta de 3 segundos.

#### Scenario: Cédula existente
- **WHEN** el usuario envía `GET /api/v1/clients?search=0961447281` con `clients:read`
- **THEN** la respuesta contiene únicamente al cliente con esa cédula en el envelope estándar
- **AND** la consulta termina en 3 segundos o menos

#### Scenario: Cédula inexistente
- **WHEN** el usuario envía una cédula de 10 dígitos que no corresponde a ningún cliente
- **THEN** la respuesta contiene `items: []`, `total: 0` y `totalPages: 0`

### Requirement: Búsqueda parcial por primer nombre o primer apellido
El sistema SHALL encontrar todos los clientes cuyo primer nombre o primer apellido contenga el texto ingresado cuando tenga al menos 2 caracteres, sin distinguir mayúsculas ni tildes.

#### Scenario: Coincidencia parcial con mayúsculas y tildes
- **WHEN** el usuario busca `jose`, `JOSE` o `josé`
- **THEN** el sistema devuelve los clientes cuyo nombre o apellido contiene «José» o «jose», sin duplicados

#### Scenario: Coincidencia con la letra ñ
- **WHEN** el usuario busca `nino`
- **THEN** el sistema devuelve también los clientes cuyo nombre o apellido contiene «Niño»

#### Scenario: Texto demasiado corto
- **WHEN** el usuario envía `search` con un solo carácter que no sea una cédula de 10 dígitos
- **THEN** el sistema responde HTTP 400 con el mensaje «Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula»

#### Scenario: Búsqueda sin parámetro
- **WHEN** el usuario omite `search`
- **THEN** el sistema devuelve el listado paginado completo, conservando el comportamiento previo

### Requirement: Listado paginado con control de acceso
El sistema SHALL devolver el listado de clientes en el envelope `{ items, total, page, pageSize, totalPages }`, con `page` por defecto 1, `pageSize` por defecto 20 y máximo 100, filtro opcional por `status`, orden por apellido y nombre, y acceso restringido a `clients:read`.

#### Scenario: Paginación y filtro combinados
- **WHEN** el usuario envía `?search=ana&status=ACTIVE&page=2&pageSize=10`
- **THEN** el sistema aplica los tres criterios y devuelve la segunda página con 10 elementos como máximo

#### Scenario: Parámetros de paginación inválidos
- **WHEN** el usuario envía `pageSize=101`, `page=0` o un valor no numérico
- **THEN** el sistema responde HTTP 400 con el mensaje que indica que `pageSize` debe estar entre 1 y 100, o que `page` debe ser al menos 1

#### Scenario: Usuario sin permiso
- **WHEN** un usuario autenticado sin `clients:read` consulta el listado
- **THEN** el sistema responde HTTP 403 con «No tiene permisos para realizar esta acción»

#### Scenario: Solicitud sin autenticación
- **WHEN** se consulta el listado sin un token válido
- **THEN** el sistema responde HTTP 401

### Requirement: Mascotas vinculadas al cliente
El sistema SHALL permitir a un usuario con `pets:read` consultar las mascotas asociadas a un cliente, para seleccionarlas de forma inmediata desde la ficha del cliente.

#### Scenario: Cliente con mascotas
- **WHEN** el usuario envía `GET /api/v1/clients/:clientId/pets` con `pets:read`
- **THEN** el sistema responde HTTP 200 con el listado de mascotas del cliente en el envelope estándar, cada una con `id`, `code`, `name`, `species`, `breed` y `status`, ordenado por nombre

#### Scenario: Cliente sin mascotas
- **WHEN** el cliente consultado no tiene mascotas vinculadas
- **THEN** el sistema responde HTTP 200 con una lista vacía

#### Scenario: Cliente inexistente
- **WHEN** el `clientId` no corresponde a ningún cliente
- **THEN** el sistema responde HTTP 404 con el mensaje «Cliente no encontrado»

#### Scenario: Identificador inválido
- **WHEN** el `clientId` no tiene formato UUID
- **THEN** el sistema responde HTTP 400 con el mensaje «Identificador inválido»

#### Scenario: Usuario sin permiso de consulta de mascotas
- **WHEN** un usuario sin `pets:read` consulta las mascotas de un cliente
- **THEN** el sistema responde HTTP 403 y no devuelve datos de mascotas
