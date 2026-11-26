## ADDED Requirements

### Requirement: Rotación de sábados (CP-024-01)

El sistema MUST asignar un veterinario por sucursal y sábado siguiendo una lista ordenada.

#### Scenario: CP-024-01 Distribuir sábados
- **GIVEN** V1 y V2 tienen jornadas 08:00–12:00 en Loja los sábados
- **AND** la lista elegible está ordenada V1, V2
- **WHEN** se generan y guardan 07, 14 y 21/11/2026
- **THEN** los turnos son V1, V2 y V1
- **AND** existe solo un veterinario por sábado

### Requirement: Sustitución manual (CP-024-02)

El sistema MUST permitir sustituir con justificación y conservar una sola asignación.

#### Scenario: CP-024-02 Sustituir por V3
- **GIVEN** V2 cubre el 14/11/2026
- **AND** V3 cubre toda la jornada sin conflictos
- **WHEN** se reemplaza a V2 por V3 con "Permiso del veterinario asignado"
- **THEN** el 14/11 queda solo V3
- **AND** se conserva la justificación

### Requirement: Repetición de profesional (CP-024-03)

El sistema MUST permitir que una sustitución repita al profesional de la semana anterior.

#### Scenario: CP-024-03 Sustituir por V1
- **GIVEN** V1 cubre el 07/11/2026
- **WHEN** se sustituye el turno del 14/11/2026 por V1
- **THEN** el 14/11 queda solo V1
- **AND** se guarda la justificación

### Requirement: Jornada inexistente (CP-024-04)

El sistema MUST rechazar fechas sin jornada base autorizada.

#### Scenario: CP-024-04 No existe horario base
- **GIVEN** no existe jornada sábado en Loja el 28/11/2026
- **WHEN** se intenta generar el turno
- **THEN** responde "No existe horario base para este sábado"
- **AND** no se crea rotación incompleta

### Requirement: Un único veterinario (CP-024-05)

El sistema MUST rechazar asignaciones con varios veterinarios para sucursal y fecha.

#### Scenario: CP-024-05 Veterinarios incompatibles
- **WHEN** se envían V1 y V2 para Loja el 07/11/2026
- **THEN** responde "Debe existir un único veterinario por sucursal y sábado"
- **AND** no cambia la base

### Requirement: Intervalos cruzados (CP-024-06)

El sistema MUST rechazar al veterinario con otra asignación en horario cruzado.

#### Scenario: CP-024-06 Veterinario en dos sucursales
- **GIVEN** V1 atiende Loja 08:00–12:00 y Vilcabamba 10:00–13:00
- **WHEN** se asigna el mismo sábado a ambas sucursales
- **THEN** responde "El veterinario ya tiene otro horario asignado en ese mismo intervalo"
- **AND** no cambia la base

### Requirement: Impacto en citas (CP-024-07)

El sistema MUST impedir sustituciones que afecten citas confirmadas y mostrar los datos afectados.

#### Scenario: CP-024-07 Cita existente
- **GIVEN** V2 tiene una cita Confirmada el 14/11/2026 de 09:00 a 09:30
- **WHEN** el administrador intenta sustituirlo por V3
- **THEN** responde "El cambio afecta una cita existente"
- **AND** muestra número, horario, paciente, cliente, consultorio, sucursal y estado
- **AND** conserva V2 y no mueve ni cancela la cita

### Requirement: Permisos de endpoints

Sin sesión el sistema MUST responder 401 y un usuario sin permiso MUST responder 403 con "No tiene permisos para esta acción".
