## ADDED Requirements

### Requirement: Cancelar una cita sin pagos aprobados

El sistema MUST permitir la cancelación ordinaria de una cita
PROGRAMADA, sin pagos aprobados, con al menos 24 horas de
anticipación y un motivo válido.

#### Scenario: CP-005-01 Cancelar exactamente 24 horas antes

- **GIVEN** una recepcionista autenticada
- **AND** una cita PROGRAMADA sin pagos aprobados
- **AND** faltan exactamente 24 horas para la cita
- **WHEN** confirma la cancelación con un motivo válido
- **THEN** la cita cambia a CANCELADA
- **AND** se liberan los recursos asociados
- **AND** se registra el motivo, responsable y fecha
- **AND** se genera una notificación de cancelación pendiente

### Requirement: Validar anticipación mínima

El sistema MUST rechazar cancelaciones ordinarias cuando
falten menos de 24 horas para la cita.

#### Scenario: CP-005-02 Cancelar con menos de 24 horas

- **GIVEN** una cita PROGRAMADA sin pagos aprobados
- **AND** faltan 23 horas y 59 minutos
- **WHEN** se solicita cancelar la cita
- **THEN** se muestra "La cancelación requiere al menos 24 horas de anticipación"
- **AND** la cita conserva su estado y recursos

### Requirement: Exigir motivo de cancelación

El sistema MUST exigir un motivo no vacío después de
eliminar los espacios iniciales y finales.

#### Scenario: CP-005-03 Motivo vacío

- **GIVEN** una cita que cumple las condiciones de cancelación
- **WHEN** se intenta cancelar sin ingresar un motivo
- **THEN** se muestra "Ingrese el motivo de cancelación"
- **AND** la cita conserva su estado y recursos

#### Scenario: CP-005-04 Motivo con espacios

- **GIVEN** una cita que cumple las condiciones de cancelación
- **WHEN** se introduce un motivo compuesto únicamente por espacios
- **THEN** se muestra "Ingrese el motivo de cancelación"
- **AND** la cita conserva su estado y recursos

### Requirement: Impedir cancelaciones ordinarias de citas pagadas

El sistema MUST rechazar la cancelación ordinaria de citas
que tengan al menos un pago aprobado.

#### Scenario: CP-005-05 Pago aprobado sin autorización

- **GIVEN** una cita PROGRAMADA con un pago aprobado de USD 20
- **WHEN** la recepcionista solicita su cancelación ordinaria
- **THEN** se muestra "La cancelación de una cita pagada requiere autorización de Administrador o Gerente"
- **AND** la cita conserva su estado
- **AND** no se modifica el pago aprobado

### Requirement: Validar estado de la cita

El sistema MUST permitir la cancelación ordinaria únicamente
cuando la cita se encuentre en estado PROGRAMADA.

#### Scenario: CP-005-06 Cita en curso

- **GIVEN** una cita EN_CURSO
- **WHEN** se solicita su cancelación
- **THEN** se rechaza con "El estado de la cita no permite cancelaciones"
- **AND** no se genera una notificación de cancelación

#### Scenario: CP-005-07 Cita finalizada

- **GIVEN** una cita FINALIZADA
- **WHEN** se solicita su cancelación
- **THEN** se rechaza con "El estado de la cita no permite cancelaciones"
- **AND** no se genera una notificación de cancelación

#### Scenario: CP-005-08 Cita cancelada

- **GIVEN** una cita CANCELADA
- **WHEN** se solicita nuevamente su cancelación
- **THEN** se rechaza con "El estado de la cita no permite cancelaciones"
- **AND** no se genera una notificación adicional

#### Scenario: CP-005-09 Cita no asistida

- **GIVEN** una cita NO_ASISTIO
- **WHEN** se solicita su cancelación
- **THEN** se rechaza con "El estado de la cita no permite cancelaciones"
- **AND** no se genera una notificación de cancelación

### Requirement: Control de acceso

El sistema MUST proteger la consulta de citas mediante
appointments:read y la cancelación mediante appointments:cancel.

#### Scenario: Solicitud sin autenticación

- **GIVEN** un usuario sin sesión válida
- **WHEN** solicita cancelar una cita
- **THEN** el sistema responde con HTTP 401

#### Scenario: Solicitud sin permiso

- **GIVEN** un usuario autenticado sin permiso appointments:cancel
- **WHEN** solicita cancelar una cita
- **THEN** el sistema responde con HTTP 403

### Requirement: Persistencia y trazabilidad

El sistema MUST realizar la actualización de la cita, el registro
del cambio de estado y la creación de la notificación pendiente
dentro de una misma transacción.

El sistema MUST conservar la cita original y sus pagos.

#### Scenario: Cancelación registrada correctamente

- **GIVEN** una cita que cumple las reglas de cancelación
- **WHEN** se confirma la operación
- **THEN** se registra el tipo de cancelación ORDINARIA
- **AND** se conserva el historial de la operación
- **AND** se crea una notificación PENDIENTE de tipo CANCELACION

### Requirement: Liberación de recursos

El sistema MUST excluir las citas CANCELADAS de la ocupación
de recursos en las consultas de disponibilidad.

#### Scenario: Consultar recursos después de cancelar

- **GIVEN** una cita que ocupa un veterinario y un consultorio
- **WHEN** se cancela correctamente
- **THEN** la cita deja de bloquear dichos recursos
- **AND** los recursos pueden aparecer disponibles si no existen otros conflictos

### Requirement: Aprobación posterior de un pago

El sistema MUST conservar el estado CANCELADA cuando llegue
la aprobación posterior de un pago y derivar el caso a revisión.

#### Scenario: Pago aprobado después de cancelar

- **GIVEN** una cita CANCELADA
- **WHEN** llega la aprobación posterior de un pago
- **THEN** la cita no se reactiva
- **AND** el caso queda sujeto a revisión
