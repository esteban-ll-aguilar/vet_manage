# Diseño: registrar cita presencial

El endpoint `POST /scheduling/appointments` valida los datos y crea la cita usando las entidades existentes `Patient`, `Servicio`, `Tarifa`, `Sala`, `Sucursal`, `User`, `BloqueoHorario` y `Cita`. Se registra en el módulo existente de recursos para no alterar el agregador de agenda. El identificador de quien registra proviene de la sesión autenticada, no del cuerpo.

La fecha y hora ingresadas se interpretan en la zona horaria `America/Guayaquil`. El servidor rechaza inicios que no sean estrictamente posteriores al momento actual. El paciente se valida contra el cliente seleccionado; la duración se contrasta con `Servicio.duracionMaximaMin`; el importe se toma de la tarifa activa para el servicio y la sucursal.

La creación y las verificaciones de bloqueos/conflictos ocurren en una transacción. Antes de leer citas superpuestas, esta adquiere bloqueos asesorados de PostgreSQL para el veterinario y el consultorio, en orden determinista. Así, reservas concurrentes para cualquiera de esos recursos se serializan; la segunda transacción observa la cita confirmada y falla sin insertar una cita parcial. Los intervalos son semiabiertos `[inicio, fin)`, por lo que citas contiguas son válidas.

La interfaz muestra los pacientes del cliente elegido y salas de tipo consultorio de la sucursal elegida. Se accede desde la sección de recursos disponibles y reutiliza `schedulingApi`. Todas las reglas de negocio se vuelven a validar en el servidor.

Como los catálogos RBAC están protegidos contra cambios en esta HU, el endpoint y la interfaz reutilizan el permiso existente `resources:read-availability`. Ese permiso fue definido para consulta; se debe sustituir por uno de creación dedicado cuando se autorice actualizar el catálogo RBAC.
