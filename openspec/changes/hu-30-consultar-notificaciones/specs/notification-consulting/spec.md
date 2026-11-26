## ADDED Requirements

### Requirement: Consultar notificaciones del usuario autenticado

El sistema SHALL mostrar al usuario autenticado las notificaciones que le
pertenecen, incluyendo título, fecha de emisión, estado de lectura, mensaje,
detalle y registro relacionado. El sistema SHALL calcular y exponer el contador
de notificaciones no leídas. El usuario SHALL poder consultar únicamente sus
propias notificaciones.

#### Scenario: Mostrar notificaciones

- **WHEN** el usuario autenticado abre el componente de notificaciones y existen notificaciones disponibles para él
- **THEN** el sistema muestra el título, la fecha, el estado de lectura, el mensaje, el detalle y el registro relacionado de cada notificación
- **AND** el sistema muestra el contador de notificaciones no leídas

#### Scenario: Aislar notificaciones de otros usuarios

- **WHEN** el usuario autenticado consulta el historial de notificaciones
- **THEN** el sistema solo incluye las notificaciones cuyo destinatario es dicho usuario
- **AND** una notificación de otro usuario no se revela ni se puede modificar

### Requirement: Marcar una notificación como leída sin eliminarla

El sistema SHALL permitir marcar una notificación propia como leída. Al
marcarla, el sistema SHALL cambiar su estado de lectura y asignar la fecha de
lectura si aún no existe, conservando la notificación en el historial. La
operación SHALL ser idempotente y no SHALL eliminar ni ocultar el registro.

#### Scenario: Marcar una notificación como leída

- **WHEN** el usuario marca una notificación sin leer como leída
- **THEN** el sistema cambia su estado a leída y registra la fecha de lectura
- **AND** la notificación permanece visible en el historial
- **AND** el contador de no leídas se actualiza

#### Scenario: Repetir el marcado de una notificación leída

- **WHEN** el usuario marca como leída una notificación que ya estaba leída
- **THEN** el sistema conserva su estado de lectura y su fecha de lectura original
- **AND** la notificación permanece en el historial

### Requirement: Abrir el registro relacionado con autorización

El sistema SHALL permitir abrir el registro relacionado de una notificación
solo cuando el usuario tenga permiso para consultarlo. El sistema SHALL validar
la propiedad de la notificación y el permiso del tipo de entidad antes de
revelar o navegar al registro relacionado. El sistema SHALL resolver únicamente
tipos de entidad y rutas soportadas dentro del módulo de Tienda/Inventario.

#### Scenario: Abrir el registro relacionado

- **WHEN** una notificación está vinculada con un producto, lote, categoría u otro registro soportado
- **AND** el usuario tiene permiso para consultar ese registro
- **THEN** el sistema resuelve el registro relacionado y permite abrirlo
- **AND** la navegación utiliza una ruta existente o implementada dentro del alcance

#### Scenario: Tipo de entidad no soportado

- **WHEN** una notificación referencia un tipo de entidad fuera de la lista permitida
- **THEN** el sistema no revela una ruta de navegación
- **AND** muestra un mensaje indicando que el registro relacionado no está disponible

### Requirement: Mostrar estado vacío de notificaciones

El sistema SHALL mostrar un mensaje comprensible cuando el usuario no tenga
notificaciones disponibles, sin tratar el estado vacío como un error.

#### Scenario: Mostrar notificaciones cuando no existen registros

- **WHEN** el usuario abre el componente de notificaciones y no tiene notificaciones disponibles
- **THEN** el sistema muestra un mensaje indicando que no existen notificaciones
- **AND** el contador de no leídas muestra cero

### Requirement: Conservar notificaciones y estados de lectura

El sistema SHALL persistir las notificaciones y su estado de lectura. Al cerrar
y volver a abrir el componente, el sistema SHALL recuperar las mismas
notificaciones con sus respectivos estados de lectura y fechas de lectura.

#### Scenario: Mantener las notificaciones después de consultarlas

- **WHEN** el usuario tiene notificaciones registradas y cierra el componente de notificaciones
- **AND** luego vuelve a abrir el componente
- **THEN** el sistema conserva las notificaciones y sus respectivos estados de lectura
- **AND** las notificaciones leídas mantienen su fecha de lectura

### Requirement: Restringir el acceso a registros relacionados

El sistema SHALL impedir el acceso al registro relacionado cuando el usuario no
tenga el permiso requerido. El sistema SHALL mostrar un mensaje indicando que no
tiene permisos suficientes y no SHALL revelar los datos del registro antes de
verificar la autorización.

#### Scenario: Restringir el acceso a registros relacionados

- **WHEN** una notificación está vinculada con un registro que el usuario no tiene permiso para consultar
- **AND** el usuario intenta abrir dicho registro
- **THEN** el sistema impide el acceso y no revela los datos del registro
- **AND** muestra un mensaje indicando que no tiene permisos suficientes
