## ADDED Requirements

### Requirement: Registro de paciente
El sistema SHALL permitir a un usuario autenticado con el permiso `pets:create` (Recepcionista, Gerente o Veterinario) registrar un paciente asociado a un cliente activo, con nombre, especie, raza, sexo (Macho o Hembra), fecha de nacimiento, peso en kg, talla en cm y estado reproductivo (Esterilizado, No esterilizado o Desconocido) obligatorios, y color opcional.

#### Scenario: Registro exitoso con datos válidos
- **WHEN** el usuario con permiso `pets:create` envía `POST /api/v1/pets` con todos los campos obligatorios válidos, una especie activa, una raza activa de esa especie y un cliente con estado `ACTIVE`
- **THEN** el sistema registra el paciente con estado `ACTIVE`, asociado al cliente seleccionado, y responde HTTP 201 con el paciente creado en el envelope estándar y el mensaje «Paciente registrado exitosamente»

#### Scenario: Registro sin color
- **WHEN** el usuario envía todos los campos obligatorios válidos y omite el color o lo envía vacío
- **THEN** el sistema registra el paciente con color nulo y responde HTTP 201 con el mensaje «Paciente registrado exitosamente»

#### Scenario: Textos con espacios sobrantes
- **WHEN** el usuario envía el nombre "  Firulais  " y el color "  Café  "
- **THEN** el sistema guarda "Firulais" y "Café"

#### Scenario: Registro por un Veterinario
- **WHEN** un usuario con el rol Veterinario envía `POST /api/v1/pets` con datos válidos
- **THEN** el sistema registra el paciente y responde HTTP 201

#### Scenario: Usuario sin permiso
- **WHEN** un usuario autenticado sin el permiso `pets:create`, por ejemplo un Técnico Veterinario, envía `POST /api/v1/pets`
- **THEN** el sistema responde HTTP 403 y no guarda nada

#### Scenario: Usuario no autenticado
- **WHEN** se envía `POST /api/v1/pets` sin un token válido
- **THEN** el sistema responde HTTP 401 y no guarda nada

### Requirement: Campos obligatorios del paciente
El sistema SHALL rechazar el registro cuando falte uno o más campos obligatorios del paciente e indicar cuáles faltan.

#### Scenario: Campos obligatorios vacíos
- **WHEN** el usuario envía el registro con uno o más de nombre, especie, raza, sexo, fecha de nacimiento, peso, talla o estado reproductivo vacíos o ausentes
- **THEN** el sistema responde HTTP 400 con el mensaje «Por favor, complete todos los campos obligatorios», lista los campos faltantes en el detalle del error y no guarda nada

#### Scenario: Textos o medidas demasiado largos
- **WHEN** el usuario envía un nombre de más de 100 caracteres, un color de más de 50, o un peso o una talla mayor que 9999.99
- **THEN** el sistema responde HTTP 400 indicando el campo y el límite, y no guarda nada

#### Scenario: Identificadores sin formato UUID
- **WHEN** el usuario envía `clientId`, `speciesId` o `breedId` sin formato UUID
- **THEN** el sistema responde HTTP 400 con el mensaje «Identificador inválido», lista los campos afectados y no guarda nada

#### Scenario: Valores fuera de las opciones permitidas
- **WHEN** el usuario envía un sexo distinto de `MALE` o `FEMALE`, o un estado reproductivo distinto de `STERILIZED`, `NOT_STERILIZED` o `UNKNOWN`
- **THEN** el sistema responde HTTP 400 indicando el campo inválido y no guarda nada

### Requirement: Cliente asociado al paciente
El sistema SHALL exigir que el paciente se asocie a un cliente registrado con estado `ACTIVE`, validado mediante el servicio del dominio de clientes.

#### Scenario: Sin cliente seleccionado
- **WHEN** el usuario envía el registro sin `clientId`
- **THEN** el sistema responde HTTP 400 con el mensaje «Debe seleccionar un cliente registrado» y no guarda nada

#### Scenario: Cliente inexistente
- **WHEN** el usuario envía un `clientId` con formato UUID que no corresponde a ningún cliente
- **THEN** el sistema responde HTTP 404 con el mensaje «Debe seleccionar un cliente registrado» y no guarda nada

#### Scenario: Cliente dado de baja o inactivo
- **WHEN** el usuario envía el `clientId` de un cliente con estado `DEACTIVATED` o `INACTIVE`
- **THEN** el sistema responde HTTP 409 con el mensaje «El cliente seleccionado no está disponible» y no guarda nada

### Requirement: Especie y raza del paciente
El sistema SHALL exigir una especie activa y una raza activa que pertenezca a esa especie.

#### Scenario: Especie inexistente o inactiva
- **WHEN** el usuario envía una especie que no existe o que está inactiva
- **THEN** el sistema responde HTTP 404 con «La especie seleccionada no existe» si no existe, o HTTP 409 con «La especie seleccionada no está disponible» si está inactiva, y no guarda nada

#### Scenario: Raza de otra especie
- **WHEN** el usuario envía una raza que pertenece a una especie distinta de la seleccionada
- **THEN** el sistema responde HTTP 400 indicando que la raza no corresponde a la especie seleccionada y no guarda nada

#### Scenario: Raza inexistente o inactiva
- **WHEN** el usuario envía una raza que no existe o que está inactiva
- **THEN** el sistema responde HTTP 404 con «La raza seleccionada no existe» si no existe, o HTTP 409 con «La raza seleccionada no está disponible» si está inactiva, y no guarda nada

### Requirement: Fecha de nacimiento válida
El sistema SHALL aceptar la fecha de nacimiento solo en formato `DD-MM-YYYY`, como fecha existente y no posterior al día actual.

#### Scenario: Fecha con formato distinto
- **WHEN** el usuario envía la fecha "2024-05-10" o "10/05/2024"
- **THEN** el sistema responde HTTP 400 con el mensaje «Fecha de nacimiento inválida» y no guarda nada

#### Scenario: Fecha inexistente
- **WHEN** el usuario envía la fecha "31-02-2024"
- **THEN** el sistema responde HTTP 400 con el mensaje «Fecha de nacimiento inválida» y no guarda nada

#### Scenario: Fecha futura
- **WHEN** el usuario envía una fecha posterior al día actual en la zona horaria de la clínica (`America/Guayaquil`), aunque el servidor ya esté en el día siguiente en UTC
- **THEN** el sistema responde HTTP 400 con el mensaje «Fecha de nacimiento inválida» y no guarda nada

#### Scenario: Fecha de hoy
- **WHEN** el usuario envía la fecha del día actual en formato `DD-MM-YYYY`
- **THEN** el sistema acepta la fecha

### Requirement: Peso y talla válidos
El sistema SHALL aceptar peso y talla solo como valores numéricos mayores que cero.

#### Scenario: Peso o talla en cero o negativos
- **WHEN** el usuario envía un peso o una talla igual a 0 o negativa
- **THEN** el sistema responde HTTP 400 con el mensaje «El peso y la talla deben ser valores numéricos mayores que cero», indica el campo inválido y no guarda nada

#### Scenario: Peso o talla no numéricos
- **WHEN** el usuario envía un peso o una talla que no es un número, por ejemplo "abc"
- **THEN** el sistema responde HTTP 400 con el mensaje «El peso y la talla deben ser valores numéricos mayores que cero», indica el campo inválido y no guarda nada

#### Scenario: Valores decimales
- **WHEN** el usuario envía el peso 12.5 y la talla 45.3
- **THEN** el sistema guarda los valores con dos decimales de precisión

### Requirement: Código identificador automático
El sistema SHALL generar al guardar un código identificador único para cada paciente con el formato `PAC-` seguido de seis dígitos, y SHALL ignorar cualquier código enviado por el usuario.

#### Scenario: Generación del código
- **WHEN** el usuario registra un paciente con datos válidos
- **THEN** la respuesta incluye un `code` con el formato `PAC-NNNNNN` que no se repite en ningún otro paciente, y queda asociado al paciente para mostrarlo en su ficha (HU-12)

#### Scenario: Códigos consecutivos
- **WHEN** se registran dos pacientes seguidos
- **THEN** cada uno recibe un código distinto

#### Scenario: Código enviado por el usuario
- **WHEN** el usuario incluye un campo `code` en el cuerpo de `POST /api/v1/pets`
- **THEN** el sistema ignora ese valor y asigna el código generado

### Requirement: Formulario de registro de pacientes
El frontend SHALL ofrecer en `/pets`, mediante el botón «Nuevo paciente» visible solo con el permiso `pets:create`, un formulario de registro en un modal que valide los datos antes de enviarlos y no permita editar el código identificador.

#### Scenario: Apertura y cierre del modal
- **WHEN** el usuario con permiso `pets:create` presiona «Nuevo paciente»
- **THEN** se abre el modal de registro con las especies activas, y se cierra con «Cancelar», con la tecla Escape o con un clic fuera del modal, salvo mientras se guarda

#### Scenario: Selección de cliente
- **WHEN** el usuario escribe en el buscador de clientes
- **THEN** el formulario muestra solo clientes con estado `ACTIVE` que coinciden con la búsqueda por nombre o cédula

#### Scenario: Raza dependiente de la especie
- **WHEN** el usuario selecciona una especie
- **THEN** el selector de raza carga solo las razas activas de esa especie y se limpia la raza elegida antes

#### Scenario: Campos faltantes en el formulario
- **WHEN** el usuario presiona «Guardar» con campos obligatorios vacíos
- **THEN** el formulario no envía la petición, resalta los campos faltantes y muestra «Por favor, complete todos los campos obligatorios»

#### Scenario: Sin cliente en el formulario
- **WHEN** el usuario presiona «Guardar» sin seleccionar un cliente
- **THEN** el formulario no envía la petición y muestra «Debe seleccionar un cliente registrado»

#### Scenario: Código no editable
- **WHEN** se muestra el formulario de registro
- **THEN** no existe ningún campo para ingresar o modificar el código identificador

#### Scenario: Confirmación del registro
- **WHEN** el registro termina con éxito
- **THEN** el modal se cierra y un toast de éxito muestra «Paciente registrado exitosamente», sin el código identificador, que se consultará en la ficha del paciente
