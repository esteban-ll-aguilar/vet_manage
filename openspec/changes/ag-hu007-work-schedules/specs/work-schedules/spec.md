## ADDED Requirements

### Requirement: Definir un horario de atención (CP-007-01)

El sistema MUST permitir al administrador registrar un horario base para un
veterinario en una sucursal, día de la semana, hora de inicio y hora de fin.
Si no existe disponibilidad diaria más corta, se utiliza toda la jornada.

#### Scenario: Registrar horario de atención válido
- **GIVEN** el administrador tiene sesión iniciada
- **AND** el veterinario no tiene horario registrado para los lunes
- **WHEN** registra atención en Loja los lunes de 08:00 a 12:00
- **AND** confirma el guardado
- **THEN** el sistema guarda el horario con sucursal Loja, día lunes,
  inicio 08:00 y fin 12:00
- **AND** se ofrecen turnos dentro de esa jornada
- **AND** si el veterinario no define una disponibilidad diaria más corta,
  se utiliza toda la jornada

### Requirement: Validar hora de fin posterior a hora de inicio (CP-007-02)

El sistema MUST impedir guardar un horario cuya hora de fin sea anterior o
igual a la hora de inicio.

#### Scenario: Intentar guardar una hora de fin incorrecta
- **GIVEN** el administrador seleccionó al veterinario, la sucursal y el lunes
- **WHEN** ingresa inicio a las 12:00 y fin a las 08:00
- **AND** intenta guardar
- **THEN** el sistema muestra "La hora de fin debe ser posterior a la hora de
  inicio"
- **AND** no se guarda el horario

### Requirement: Impedir horarios cruzados entre sucursales (CP-007-03)

El sistema MUST impedir asignar un horario que se cruce con otro horario
existente del mismo veterinario en el mismo día, sin importar la sucursal.

#### Scenario: Intentar asignar horarios que se cruzan entre sucursales
- **GIVEN** el veterinario atiende los lunes de 08:00 a 12:00 en Loja
- **WHEN** el administrador intenta asignarle atención en Vilcabamba los lunes
  de 10:00 a 13:00
- **AND** intenta guardar
- **THEN** el sistema muestra "El veterinario ya tiene otro horario asignado
  en ese mismo intervalo"
- **AND** se conserva el horario anterior

### Requirement: Impedir reducción que afecte citas o disponibilidad (CP-007-04)

El sistema MUST impedir la reducción de un horario cuando existan citas
confirmadas o disponibilidad diaria registrada que queden fuera del nuevo rango.

#### Scenario: Intentar reducir la jornada afectando citas existentes
- **GIVEN** el veterinario tiene una cita Confirmada a las 11:00 y
  disponibilidad diaria registrada hasta las 12:00
- **WHEN** el administrador intenta reducir su jornada de 08:00 a 10:00
- **AND** intenta guardar
- **THEN** el sistema muestra "El cambio afecta citas o disponibilidad diaria
  existente"
- **AND** se conserva el horario anterior y no se cambian las citas
  automáticamente

### Requirement: Impedir configuración sin permiso (CP-007-05)

El sistema MUST impedir que un usuario sin el permiso `work-schedules:manage`
cree, modifique o elimine horarios.

#### Scenario: Intentar configurar horarios sin permiso
- **GIVEN** una recepcionista inició sesión
- **WHEN** intenta guardar un horario de atención
- **THEN** el sistema responde con estado 403
- **AND** muestra "No tiene permisos para esta acción"
- **AND** el horario no cambia

### Requirement: Validar horas en punto o media hora

El sistema MUST aceptar únicamente horas de inicio y fin que sean en punto
(`:00`) o en media hora (`:30`).

#### Scenario: Intentar guardar una hora que no es en punto ni media hora
- **GIVEN** el administrador seleccionó al veterinario y la sucursal
- **WHEN** ingresa inicio a las 08:15 y fin a las 12:00
- **THEN** el sistema muestra "Las horas deben ser en punto o media hora"
- **AND** no se guarda el horario
