## ADDED Requirements

### Requirement: Registrar citas presenciales

El sistema MUST permitir a una persona con el permiso existente `resources:read-availability` registrar una cita presencial con sucursal, cliente, paciente, servicio, veterinario, consultorio, fecha, hora de inicio y duración obligatorios. El paciente MUST pertenecer al cliente elegido. La fecha y hora MUST ser posteriores al momento actual. La duración MUST ser de al menos 30 minutos y no superar el máximo configurado para el servicio.

La cita MUST guardar hora de fin calculada, tarifa vigente del servicio en la sucursal, un número único y estado `PROGRAMADA`.

#### Scenario: CP-003-01 Confirmar el registro exitoso

- **WHEN** todos los datos y recursos son válidos y están disponibles
- **THEN** el sistema registra la cita como `PROGRAMADA`
- **AND** calcula la hora de fin y guarda la tarifa vigente
- **AND** asigna un número único
- **AND** muestra `Cita registrada`

#### Scenario: CP-003-02 Bloquear campos obligatorios vacíos

- **WHEN** la Recepcionista intenta guardar la cita con campos requeridos vacíos
- **THEN** el formulario bloquea el envío
- **AND** señala cada campo faltante

#### Scenario: CP-003-03 Rechazar veterinario ocupado

- **WHEN** el veterinario tiene una cita no cancelada que se superpone con el intervalo solicitado
- **THEN** el sistema rechaza el registro con `Veterinario no disponible`

#### Scenario: CP-003-04 Rechazar consultorio ocupado

- **WHEN** el consultorio tiene una cita no cancelada que se superpone con el intervalo solicitado
- **THEN** el sistema rechaza el registro con `Consultorio no disponible`

#### Scenario: CP-003-05 Rechazar un horario bloqueado

- **WHEN** existe un bloqueo activo de la sucursal o del veterinario seleccionado que se superpone con la cita
- **THEN** el sistema rechaza el registro con `Horario bloqueado`

#### Scenario: CP-003-06 Rechazar fecha y hora pasadas o actuales

- **WHEN** el inicio de la cita no es estrictamente posterior al momento actual
- **THEN** el sistema rechaza el registro con `La fecha y hora deben ser posteriores al momento actual`

#### Scenario: CP-003-07 Serializar reservas concurrentes

- **WHEN** dos Recepcionistas registran simultáneamente citas superpuestas para el mismo veterinario o consultorio
- **THEN** solo una cita se registra
- **AND** el otro intento falla con `Veterinario no disponible` o `Consultorio no disponible`
- **AND** no se crea un registro parcial

#### Scenario: CP-003-08 Rechazar paciente de otro cliente

- **WHEN** el paciente seleccionado no pertenece al cliente seleccionado
- **THEN** el sistema rechaza el registro con `El paciente no pertenece al cliente`

#### Scenario: CP-003-09 Rechazar duración fuera del rango permitido

- **WHEN** la duración es menor a 30 minutos o supera la duración máxima del servicio
- **THEN** el sistema rechaza el registro con `La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio`
