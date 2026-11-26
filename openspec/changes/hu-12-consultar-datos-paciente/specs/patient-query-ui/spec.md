## ADDED Requirements

### Requirement: Vista de consulta de pacientes en `/pets`
El frontend SHALL reemplazar en `/pets` los textos «El listado de pacientes estará disponible próximamente» y «Desde aquí se podrán consultar los pacientes registrados» por una vista con buscador y tabla, conservando el botón «Nuevo paciente» de HU-07. La tabla SHALL mostrar código, nombre, especie, cliente asociado y estado de cada paciente, con controles de paginación de 20 registros.

#### Scenario: Vista inicial
- **WHEN** un usuario con `pets:read` abre `/pets`
- **THEN** el texto de «próximamente» ya no se muestra
- **AND** la tabla muestra los primeros 20 pacientes ordenados por nombre y código con su estado

#### Scenario: Navegación de páginas
- **WHEN** el usuario selecciona la página siguiente
- **THEN** la tabla muestra la siguiente página de pacientes
- **AND** el término de búsqueda permanece aplicado

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `pets:read` intenta abrir `/pets`
- **THEN** el guard `RequirePermission` existente muestra «No tiene permisos para realizar esta acción»
- **AND** la tabla de pacientes no se renderiza

### Requirement: Buscador de pacientes
El frontend SHALL ofrecer un campo de búsqueda y un botón «Buscar» que envíen el término a `GET /api/v1/pets`, y SHALL omitir la petición cuando el campo esté vacío. El buscador SHALL aceptar nombre del paciente, código `PAC-` con 4 a 6 dígitos, primer nombre del cliente y prefijo de cédula del cliente.

#### Scenario: Búsqueda por nombre del paciente
- **WHEN** el usuario ingresa `jos` o ` JOSE ` y presiona «Buscar»
- **THEN** la tabla muestra los pacientes cuyo nombre coincide sin distinguir mayúsculas ni tildes

#### Scenario: Búsqueda por código
- **WHEN** el usuario ingresa `PAC-0001` y presiona «Buscar»
- **THEN** la tabla muestra únicamente el paciente con ese código

#### Scenario: Búsqueda por cliente
- **WHEN** el usuario ingresa al menos 3 caracteres del primer nombre del cliente o entre 5 y 10 dígitos de su cédula y presiona «Buscar»
- **THEN** la tabla muestra los pacientes asociados a ese cliente

#### Scenario: Criterio vacío
- **WHEN** el usuario presiona «Buscar» sin ingresar ningún criterio
- **THEN** el sistema no ejecuta la consulta
- **AND** la tabla conserva su estado anterior

#### Scenario: Limpiar búsqueda
- **WHEN** el usuario presiona «Limpiar búsqueda»
- **THEN** se restablece el campo, se limpia el término y se vuelve a la primera página

### Requirement: Resultados vacíos y ficha del paciente
El frontend SHALL mostrar el mensaje «No se encontraron pacientes que coincidan con la búsqueda» cuando la consulta no devuelva resultados, y SHALL permitir seleccionar un paciente de la tabla para abrir su ficha en modo solo lectura con los datos devueltos por la consulta.

#### Scenario: Sin resultados
- **WHEN** una búsqueda devuelve `items: []`
- **THEN** la pantalla muestra «No se encontraron pacientes que coincidan con la búsqueda»
- **AND** no se renderizan filas de pacientes

#### Scenario: Selección de un paciente
- **WHEN** el usuario selecciona un paciente de los resultados
- **THEN** se abre su ficha en modo solo lectura con código, nombre, especie, cliente, estado y datos clínicos básicos
- **AND** la ficha no permite editar, inactivar ni dar de baja al paciente

#### Scenario: Cierre de la ficha
- **WHEN** el usuario cierra la ficha del paciente
- **THEN** la tabla y los criterios de búsqueda se conservan
