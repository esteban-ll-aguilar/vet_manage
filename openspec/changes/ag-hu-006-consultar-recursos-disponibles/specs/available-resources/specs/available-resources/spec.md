
## ADDED Requirements

### Requirement: Consultar recursos realmente disponibles (CP-006-01)

El sistema MUST mostrar únicamente veterinarios activos y consultorios activos de la sucursal seleccionada que estén disponibles durante todo el intervalo solicitado.

La consulta MUST considerar horarios base, disponibilidad diaria, turnos de sábado, citas existentes y bloqueos activos.

#### Scenario: CP-006-01 Consultar los recursos que realmente están libres

- **GIVEN** una sucursal con veterinarios y consultorios activos
- **AND** existen jornadas autorizadas que cubren el intervalo solicitado
- **AND** algunos recursos están ocupados por citas o afectados por bloqueos
- **WHEN** la recepcionista consulta la disponibilidad para una fecha futura, hora y duración válidas
- **THEN** el sistema devuelve únicamente los veterinarios libres durante todo el intervalo
- **AND** devuelve únicamente los consultorios libres de la sucursal
- **AND** excluye los recursos que presentan conflictos

### Requirement: Excluir veterinarios con horario bloqueado (CP-006-02)

El sistema MUST excluir a un veterinario cuando exista un bloqueo activo que se superponga con el intervalo consultado.

Los bloqueos generales de la sucursal MUST aplicarse a los veterinarios de esa sucursal.

#### Scenario: CP-006-02 Excluir a un veterinario con horario bloqueado

- **GIVEN** un veterinario activo con jornada autorizada
- **AND** existe un bloqueo activo que se superpone parcialmente con el intervalo solicitado
- **WHEN** la recepcionista consulta la disponibilidad
- **THEN** el veterinario bloqueado no aparece entre los disponibles
- **AND** no se muestran veterinarios afectados por un bloqueo general de la sucursal

### Requirement: Consultar cuando falta un recurso (CP-006-03)

El sistema MUST informar cuando no exista al menos un veterinario o un consultorio disponible para completar la selección.

#### Scenario: CP-006-03 Consultar cuando falta un recurso

- **GIVEN** existe al menos un tipo de recurso sin disponibilidad durante el intervalo
- **WHEN** la recepcionista consulta los recursos disponibles
- **THEN** el sistema muestra "Sin disponibilidad en el intervalo seleccionado"
- **AND** no permite confirmar una selección incompleta

### Requirement: Rechazar fechas pasadas (CP-006-04)

El sistema MUST rechazar consultas cuya fecha sea anterior a la fecha actual.

#### Scenario: CP-006-04 Consultar una fecha pasada

- **GIVEN** la recepcionista selecciona una fecha anterior a la fecha actual
- **WHEN** solicita consultar los recursos disponibles
- **THEN** el sistema rechaza la consulta
- **AND** informa que no se permite consultar una fecha pasada

### Requirement: Validar duración de la consulta (CP-006-05)

El sistema MUST exigir una duración de al menos 30 minutos y múltiplo de 30.

#### Scenario: CP-006-05 Consultar una duración inválida

- **GIVEN** la recepcionista introduce una duración de 0 minutos o que no es múltiplo de 30
- **WHEN** solicita consultar los recursos disponibles
- **THEN** el sistema rechaza la consulta
- **AND** informa que la duración debe ser de al menos 30 minutos y múltiplo de 30

### Requirement: Permisos de consulta

El sistema MUST proteger la consulta mediante el permiso existente `resources:read-availability`.

Sin sesión, el endpoint MUST responder 401. Un usuario sin el permiso requerido MUST recibir 403.
