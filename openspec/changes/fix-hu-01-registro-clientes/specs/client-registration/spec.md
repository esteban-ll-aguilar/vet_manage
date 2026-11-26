## MODIFIED Requirements

### Requirement: Registro de clientes con validación específica
El sistema SHALL permitir registrar datos de clientes con validaciones específicas para cédula, nombre, apellido, teléfono y correo electrónico, respetando que una Persona se registra una sola vez aunque sea Cliente y empleado.

#### Scenario: Registro exitoso de un cliente con datos válidos
- **WHEN** el usuario ingresa los campos obligatorios (cédula de 10 dígitos numéricos, primer nombre, primer apellido, teléfono de exactamente 10 dígitos con prefijo `09` y correo con formato usuario@dominio.com) y presiona el botón "Guardar"
- **THEN** el sistema debe guardar el cliente en la base de datos con estado "Activo"
- **AND** debe mostrar el mensaje "Cliente registrado exitosamente"

#### Scenario: Omitir campos obligatorios
- **WHEN** el usuario deja en blanco uno o más campos obligatorios, incluido el teléfono, y presiona el botón "Guardar"
- **THEN** el sistema debe detener el guardado del registro
- **AND** debe resaltar los campos requeridos vacíos y mostrar el mensaje "Por favor, complete todos los campos obligatorios"

#### Scenario: Registrar una identificación de cliente existente
- **WHEN** existe un cliente registrado en el sistema con un número de cédula, con cualquier estado de registro
- **AND** el usuario ingresa ese mismo número de cédula junto a los demás datos requeridos y presiona el botón "Guardar"
- **THEN** el sistema debe rechazar la transacción con HTTP 409
- **AND** debe mostrar el mensaje "Número de cédula ya registrado"
- **AND** no debe crear otro cliente ni modificar los pacientes asociados al cliente existente

#### Scenario: Registrar como cliente a un personal sin cliente
- **WHEN** existe una Persona con la cédula ingresada y al menos un rol `STAFF` activo, pero sin registro de cliente
- **AND** el usuario ingresa los demás datos requeridos y presiona el botón "Guardar"
- **THEN** el sistema debe reutilizar la misma Persona y la misma cuenta de usuario
- **AND** debe agregar el rol `client` a la cuenta existente y crear el registro de cliente con estado "Activo"
- **AND** no debe cambiar la contraseña ni enviar credenciales nuevas
- **AND** no debe sobrescribir nombre, apellido, correo ni teléfono de la Persona
- **AND** debe mostrar el mensaje "Cliente registrado exitosamente"

#### Scenario: Validar número de cédula inválido
- **WHEN** el usuario ingresa un número de cédula que no cumple con el formato exacto de 10 dígitos numéricos (ej. alfanumérico o longitud diferente) y presiona el botón "Guardar"
- **THEN** el sistema debe rechazar la transacción
- **AND** debe resaltar el campo cédula y mostrar el mensaje "Número de cédula no válido"

#### Scenario: Validar formato incorrecto en correo electrónico y teléfono
- **WHEN** el usuario ingresa un correo electrónico sin formato válido, un teléfono con caracteres alfabéticos, un teléfono con 9 u 11 dígitos, un teléfono con prefijo distinto de `09`, o una combinación de estos, y presiona el botón "Guardar"
- **THEN** el sistema debe bloquear el guardado del registro
- **AND** debe resaltar los campos erróneos y mostrar el mensaje "Por favor, ingrese un correo y número de teléfono válido"

#### Scenario: Registro de cliente con dirección opcional
- **WHEN** el usuario ingresa datos válidos incluyendo una dirección opcional y presiona el botón "Guardar"
- **THEN** el sistema debe guardar el cliente en la base de datos con la dirección proporcionada
- **AND** debe mostrar el mensaje "Cliente registrado exitosamente"

#### Scenario: Dirección dentro y fuera del límite
- **WHEN** el usuario ingresa una dirección de 255 caracteres
- **THEN** el sistema debe registrar el cliente
- **WHEN** el usuario ingresa una dirección de 256 caracteres
- **THEN** el sistema debe rechazar la transacción y mostrar el mensaje "Dirección no válida"
