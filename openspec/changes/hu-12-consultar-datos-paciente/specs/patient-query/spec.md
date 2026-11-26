## ADDED Requirements

### Requirement: Listado paginado de pacientes
El sistema SHALL exponer `GET /api/v1/pets` con el envelope `{ items, total, page, pageSize, totalPages }`, paginación por defecto 1/20 (máximo 100) y orden por nombre y código. Cada elemento SHALL incluir identificación, cliente, estado y datos clínicos básicos. `totalPages` SHALL ser 0 cuando `total` sea 0 y el listado SHALL incluir todos los estados.

#### Scenario: Listado inicial
- **WHEN** un usuario con `pets:read` solicita `GET /api/v1/pets` sin filtros
- **THEN** la respuesta contiene como máximo 20 pacientes ordenados por nombre y código
- **AND** cada elemento incluye `id`, código, nombre, especie, raza, cliente, estado y datos clínicos básicos (`gender`, `birthDate` en `DD-MM-YYYY`, `weightKg`, `heightCm`, `reproductiveStatus`, `color`)

#### Scenario: Segunda página
- **WHEN** el usuario solicita `?page=2`
- **THEN** la respuesta contiene los siguientes pacientes en el mismo orden
- **AND** `total` y `totalPages` reflejan el número de pacientes existentes

#### Scenario: Pacientes de cualquier estado
- **WHEN** existen pacientes en estado `ACTIVE`, `INACTIVE` y `DEACTIVATED`
- **THEN** los tres aparecen en los resultados
- **AND** cada uno muestra su estado correspondiente

#### Scenario: Página sin resultados
- **WHEN** el usuario solicita una página posterior a la última
- **THEN** la respuesta devuelve `items: []` con HTTP 200
- **AND** `total` conserva el número de pacientes que coinciden con los filtros

### Requirement: Búsqueda por nombre o código del paciente
El sistema SHALL aceptar el parámetro opcional `search` y encontrar pacientes cuyo `name` contenga el criterio de forma parcial, sin distinguir mayúsculas, tildes ni espacios sobrantes, y SHALL encontrar por igualdad exacta el `code` con formato `PAC-` seguido de 4 a 6 dígitos. La normalización SHALL eliminar espacios exteriores, convertir a minúsculas, descomponer caracteres acentuados y tratar `ñ` como `n`.

#### Scenario: Coincidencia parcial por nombre del paciente
- **WHEN** el usuario busca `jos`, `JOSE` o ` josé ` y existe un paciente llamado «José»
- **THEN** el paciente «José» aparece entre los resultados

#### Scenario: Búsqueda por código identificador
- **WHEN** el usuario busca `PAC-0001`
- **THEN** la respuesta contiene únicamente el paciente con ese código

#### Scenario: Código inexistente
- **WHEN** el usuario busca un código `PAC-9999` que no corresponde a ningún paciente
- **THEN** la respuesta devuelve `items: []` y `total` igual a 0

#### Scenario: Criterio de texto demasiado corto
- **WHEN** el usuario envía `search` con un solo carácter que no es un código ni una cédula
- **THEN** el sistema responde HTTP 400 con el mensaje «Ingrese al menos 2 caracteres para buscar por nombre o el código del paciente»

#### Scenario: Sin parámetro de búsqueda
- **WHEN** el usuario omite `search`
- **THEN** el sistema devuelve el listado paginado completo

### Requirement: Búsqueda por el cliente asociado
El sistema SHALL encontrar los pacientes cuyo cliente asociado tenga un primer nombre que contenga el criterio cuando este tenga al menos 3 caracteres, o cuya cédula comience con los dígitos ingresados cuando el criterio tenga entre 5 y 10 dígitos. La comparación SHALL ignorar mayúsculas, tildes y espacios sobrantes, y los resultados SHALL combinar todas las coincidencias aplicables sin duplicar pacientes.

#### Scenario: Coincidencia por primer nombre del cliente
- **WHEN** el usuario busca `ana` y existen clientes con primer nombre «Ana» y «Anabel» con pacientes asociados
- **THEN** se devuelven los pacientes de ambos clientes

#### Scenario: Coincidencia por primer nombre con acento
- **WHEN** el usuario busca `jose` y el cliente se llama «José»
- **THEN** se devuelven los pacientes asociados a ese cliente

#### Scenario: Prefijo de cédula del cliente
- **WHEN** el usuario busca `096144` y la cédula del cliente comienza con esos dígitos
- **THEN** se devuelven los pacientes asociados a ese cliente

#### Scenario: Cédula con menos de cinco dígitos
- **WHEN** el usuario busca `0961`
- **THEN** el criterio no se usa como cédula y se evalúa como texto de nombre

#### Scenario: Sin coincidencias
- **WHEN** el criterio no coincide con ningún paciente ni con el nombre o la cédula de su cliente
- **THEN** la respuesta devuelve `items: []` y `total` igual a 0

### Requirement: Control de acceso de la consulta de pacientes
El sistema SHALL exigir autenticación y el permiso `pets:read` para `GET /api/v1/pets`. Las respuestas de error SHALL usar el envelope estándar.

#### Scenario: Usuario no autenticado
- **WHEN** se envía `GET /api/v1/pets` sin un token válido
- **THEN** el sistema responde HTTP 401 y no devuelve pacientes

#### Scenario: Usuario sin permiso
- **WHEN** un usuario autenticado sin `pets:read` solicita el listado
- **THEN** el sistema responde HTTP 403 con el mensaje «No tiene permisos para realizar esta acción»

#### Scenario: Parámetros de paginación inválidos
- **WHEN** el usuario solicita `page=0` o `pageSize=101`
- **THEN** el sistema responde HTTP 400 con el envelope estándar
