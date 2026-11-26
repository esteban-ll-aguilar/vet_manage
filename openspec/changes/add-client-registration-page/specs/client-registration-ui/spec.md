## ADDED Requirements

### Requirement: Pantalla de clientes reutiliza el diseño de usuarios
El frontend SHALL reemplazar el placeholder de `/clients` por una pantalla que conserve la estructura visual y los componentes de `/users`, y SHALL mostrar la acción "Nuevo cliente" en lugar de "Nuevo usuario".

#### Scenario: Acceso a la sección de clientes
- **WHEN** un usuario con permiso `clients:read` navega a `/clients`
- **THEN** el sistema debe mostrar la interfaz de clientes en lugar del mensaje "Módulo en preparación"
- **AND** debe reutilizar el diseño de la pantalla de usuarios

#### Scenario: Acción principal de la pantalla
- **WHEN** se muestra la pantalla `/clients` a un usuario con permiso `clients:create`
- **THEN** el sistema debe mostrar un botón etiquetado "Nuevo cliente"
- **AND** el botón debe reemplazar al botón "Nuevo usuario" usado en `/users`

#### Scenario: Usuario sin permiso de creación
- **WHEN** un usuario sin permiso `clients:create` visita `/clients`
- **THEN** el sistema no debe mostrar el botón "Nuevo cliente"
- **AND** debe impedir el acceso directo a `/clients/new`

### Requirement: Ruta y formulario de registro de cliente
El sistema SHALL exponer `/clients/new` con un formulario que reutilice los componentes y el diseño de `/users/new`, adaptado exclusivamente al registro de clientes.

#### Scenario: Apertura del formulario desde el listado
- **WHEN** un usuario con permiso `clients:create` pulsa "Nuevo cliente" en `/clients`
- **THEN** el sistema debe navegar a `/clients/new`
- **AND** debe mostrar el formulario de registro con los mismos componentes y diseño que `/users/new`

#### Scenario: Secciones visibles del formulario
- **WHEN** se muestra `/clients/new`
- **THEN** el sistema debe mostrar la sección de ingreso de datos del cliente con cédula, nombres, apellidos, correo, teléfono y dirección
- **AND** debe mostrar una sección de roles donde el rol `client` aparezca preseleccionado

#### Scenario: Rol único del cliente
- **WHEN** el usuario visualiza la sección de roles en `/clients/new`
- **THEN** el sistema debe mostrar únicamente el rol `client` como seleccionado
- **AND** no debe permitir al usuario seleccionar roles del personal

#### Scenario: Etiqueta de la acción principal
- **WHEN** se muestra el formulario `/clients/new`
- **THEN** el botón principal debe decir "Guardar cliente"
- **AND** debe ejecutar el registro del cliente al ser pulsado

### Requirement: Registro de cliente desde la interfaz
El sistema SHALL enviar los datos del formulario a `POST /api/v1/clients` y SHALL reflejar el resultado devuelto por el backend.

#### Scenario: Registro exitoso
- **WHEN** el usuario completa los datos obligatorios del cliente y pulsa "Guardar cliente"
- **THEN** el sistema debe enviar una solicitud a `POST /api/v1/clients` con los datos ingresados y el rol `client`
- **AND** debe mostrar el mensaje de éxito devuelto por el backend y permitir volver a `/clients`

#### Scenario: Error de validación del backend
- **WHEN** el backend rechaza el registro por datos inválidos o duplicados
- **THEN** el sistema debe mostrar el mensaje de error devuelto por el backend
- **AND** debe mantener los datos ingresados en el formulario para su corrección

#### Scenario: Error de red o del servidor
- **WHEN** la solicitud de registro falla por un error de red o del servidor
- **THEN** el sistema debe mostrar un mensaje de error claro
- **AND** no debe navegar a `/clients` ni dar por exitoso el registro

### Requirement: Pruebas del flujo de registro de cliente
El sistema SHALL contar con pruebas automatizadas que verifiquen la navegación, el formulario y el envío al endpoint de registro.

#### Scenario: Cobertura del flujo principal
- **WHEN** se ejecuten las pruebas del frontend
- **THEN** deben cubrirse la visualización de `/clients`, la navegación a `/clients/new`, el rol `client` preseleccionado y el envío a `POST /api/v1/clients`
- **AND** deben cubrirse los estados de éxito y error del registro
