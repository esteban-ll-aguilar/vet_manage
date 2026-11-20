## ADDED Requirements

### Requirement: Consulta de clientes desde el módulo de clientes
El frontend SHALL reemplazar el placeholder de `/clients` por una tabla de clientes con buscador, filtro de estado y paginación, consumiendo `GET /api/v1/clients` y conservando el botón «Nuevo cliente».

#### Scenario: Vista inicial
- **WHEN** un usuario con `clients:read` abre `/clients`
- **THEN** el placeholder «El listado de clientes estará disponible próximamente» no se muestra
- **AND** la tabla muestra los primeros 20 clientes ordenados por apellido y nombre, con cédula, nombre, correo, estado y mascotas

#### Scenario: Navegación de páginas
- **WHEN** el usuario selecciona la página siguiente
- **THEN** la tabla muestra la siguiente página y se conservan el término de búsqueda y los filtros

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `clients:read` intenta abrir `/clients`
- **THEN** la aplicación muestra «No tiene permisos para realizar esta acción» y no renderiza la tabla

### Requirement: Búsqueda por cédula o nombre
El frontend SHALL ofrecer un campo de búsqueda y un botón «Buscar» que envíen el término al listado de clientes y validen los criterios de HU-06 antes de consultar.

#### Scenario: Búsqueda por cédula
- **WHEN** el usuario ingresa una cédula de 10 dígitos y presiona «Buscar»
- **THEN** la tabla muestra únicamente la ficha del cliente coincidente

#### Scenario: Búsqueda por nombre o apellido
- **WHEN** el usuario ingresa al menos 2 caracteres del nombre o apellido, con o sin tildes, y presiona «Buscar»
- **THEN** la tabla muestra todos los clientes que coinciden, sin distinguir mayúsculas ni tildes

#### Scenario: Búsqueda demasiado corta
- **WHEN** el usuario presiona «Buscar» con un solo carácter
- **THEN** la pantalla no envía la petición y muestra «Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula»

#### Scenario: Limpiar búsqueda
- **WHEN** el usuario presiona «Limpiar búsqueda»
- **THEN** se restablecen el término, los filtros y la primera página

### Requirement: Visualización de mascotas vinculadas
El frontend SHALL permitir expandir la ficha de un cliente de los resultados para consultar y mostrar sus mascotas vinculadas.

#### Scenario: Cliente con mascotas
- **WHEN** el usuario selecciona un cliente de los resultados
- **THEN** la pantalla muestra sus mascotas con nombre, especie, raza y estado

#### Scenario: Cliente sin mascotas
- **WHEN** el cliente seleccionado no tiene mascotas vinculadas
- **THEN** la pantalla muestra «Sin mascotas vinculadas»

#### Scenario: Fallo al consultar mascotas
- **WHEN** la consulta de mascotas falla
- **THEN** la pantalla muestra un mensaje de error en la fila expandida sin ocultar el resto de los resultados

### Requirement: Sin resultados y registro alternativo
El frontend SHALL informar cuando la búsqueda no produce coincidencias y SHALL ofrecer la opción de registrar un nuevo cliente.

#### Scenario: Sin coincidencias
- **WHEN** una búsqueda devuelve una lista vacía
- **THEN** la pantalla muestra exactamente «No se encontraron clientes registrados con el criterio ingresado»
- **AND** no se renderizan filas de clientes

#### Scenario: Registrar nuevo cliente desde el estado vacío
- **WHEN** el estado vacío se muestra a un usuario con `clients:create`
- **THEN** la opción «Registrar nuevo cliente» lleva a `/clients/new`

#### Scenario: Sin permiso de creación
- **WHEN** el estado vacío se muestra a un usuario sin `clients:create`
- **THEN** la opción «Registrar nuevo cliente» no está disponible
