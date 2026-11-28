# Diseño HU-001

## Lectura y fechas
GET `/api/v1/scheduling/calendar?sucursalId=UUID&fecha=YYYY-MM-DD&vista=dia|semana|mes` devuelve período [inicio, fin exclusivo), citas y franjas. Semana lunes–domingo; mes completo. La base guarda la hora de pared de Ecuador continental en componentes UTC, siguiendo `toStoredDateTime` de HU-003/HU-004. Las consultas y el cálculo de ocupación usan esa misma representación; únicamente al responder, `storedDateTimeToInstant` convierte citas y franjas a instantes ISO reales en America/Guayaquil (UTC-05). Fechas SQL DATE y horas TIME conservan sus componentes UTC. El navegador formatea esos instantes explícitamente en America/Guayaquil, independientemente de su zona local. No se llama al servicio HU-006 ni se elimina su validación de fechas pasadas. Intersección estricta: inicio cita < fin período y fin cita > inicio período.

GET `/scheduling/calendar/branches` lista sucursales, incluidas inactivas para lectura histórica. GET `/scheduling/calendar/appointments/:id?sucursalId=UUID` entrega detalle acotado a sucursal; 404 si no coincide. Todos exigen calendar:read y sesión mediante las guardas de identidad del controlador. El listado no incluye cédula; detalle obtiene Patient.client.person.identification y sala.sucursal. Solo recepcionista y el superadmin existente reciben permiso por defecto.

## Franjas
Snapshot consistente de solo lectura por período. Jornada activa y veterinario activo con rol vigente; disponibilidad diaria restringe la jornada si existe; sábado requiere turno; domingo fuera de atención. Se requiere un consultorio activo libre y un veterinario libre durante los 30 minutos. Citas de otras sucursales ocupan al mismo veterinario. Todos los estados excepto CANCELADA ocupan recursos, siguiendo la implementación actual de HU-006, sin resolver ni alterar la discrepancia de reglas de otras historias.

Estados agregados: Disponible si queda una pareja; Bloqueado si un bloqueo general se cruza o todos los veterinarios de jornada están bloqueados; Fuera de atención si no hay jornada efectiva; Ocupado si citas impiden la pareja; Sin recursos si faltan consultorios activos. Los bloqueos individuales no cierran toda la sucursal si queda otro veterinario. Se aplica primero bloqueo general, después jornada, bloqueo total y recursos/ocupación. El filtro de citas es exclusivamente de presentación y nunca entra al cálculo.

La lectura histórica usa configuración actualmente almacenada: el esquema no versiona horarios, estados de recursos ni bloqueos eliminados. No se promete reconstruir configuración histórica borrada.

## Interfaz e integración
Día y semana muestran citas por día; mes usa cuadrícula lunes–domingo. Cada día permite desplegar sus 48 franjas. Detalle con diálogo nativo y foco de retorno. Colores con nombres legibles. Solo Disponible habilita seleccionar la franja; un aviso explica que la selección no crea una cita y ofrece Registrar cita. El enlace abre `/appointments/appointments/new` con los parámetros `sucursalId`, `fecha` y `horaInicio`, calculados explícitamente en America/Guayaquil. La ruta existente exige `appointments:create` y precarga únicamente esos tres campos del formulario de HU-003. Abrir el formulario no escribe datos; al guardar se conservan la validación del formulario y la comprobación de disponibilidad del backend.

## Operación
Sin variables ni puertos nuevos: API 3080, frontend 5174, PostgreSQL Docker por nombre de servicio. Comandos existentes npm test, npm run lint, npm run build en ambos proyectos. Sin migración ni seed. El arranque normal sincroniza el catálogo RBAC. En modo create-only, si calendar:read ya existe pero falta una asignación, se debe conceder mediante la gestión habitual de permisos.

Los fixtures de persistencia usan el contrato existente (10:00 en Loja se almacena como 10:00Z); la respuesta del calendario lo normaliza a 15:00Z y la interfaz muestra 10:00. HU-006, el listado, las modificaciones y los seeds conservan su contrato. No se migran datos ni se cambia la escritura de citas. La normalización se aplica solo a citas y franjas del calendario, nunca a auditorías o timestamps UTC reales.
