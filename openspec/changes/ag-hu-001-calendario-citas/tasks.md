# Tareas HU-001
- [x] Revisar base Git, instrucciones y OpenSpec existente.
- [x] Definir propuesta, diseño y escenarios CP-001-01 a CP-001-04.
- [x] Implementar consultas y detalle acotados a sucursal, validación y autorización.
- [x] Implementar franjas históricas con ocupación sin filtro y fechas Ecuador.
- [x] Implementar vistas, navegación, filtros, detalle y punto de integración honesto.
- [x] Probar criterios, límites, sucursales, autorización y regresión HU-006.
- [x] Validar OpenSpec, pruebas, lint, builds y git diff --check; documentar resultados.

## Verificación del 26/11/2026

- OpenSpec: validación estricta del cambio.
- Backend: 793 pruebas, incluida la regresión de HU-006. Build de Nest en salida temporal por permisos del directorio dist local.
- Frontend: 432 pruebas y build Vite.
- Lint de ambos proyectos y git diff --check. Advertencias ajenas a HU-001 en lint y aviso de tamaño de bundle en Vite.
- Las pruebas de calendario usan fixtures y dobles de Prisma. No se ejecutaron suites E2E con base de datos ni migraciones.

## Revisión e integración del 27/11/2026

- Integrada `origin/development` (228e14c) conservando CalendarModule/CalendarPage y AppointmentsModule/AppointmentsPage en los dos archivos en conflicto.
- Corregido el desfase de cinco horas: consultas y ocupación usan el contrato de persistencia compartido con HU-003/HU-004. Las respuestas del calendario normalizan a instantes ISO reales para mostrarlos en America/Guayaquil.
- Regresión para 00:00, 10:00 y 23:00 del 31 de diciembre; detalle, franja y cita deben coincidir. Se excluyen jornadas con rol de veterinario vencido.
- Backend: 1.013 pruebas aprobadas (103 archivos), incluidas HU-003/HU-004/HU-005/HU-006 y 31 de calendario. Las pruebas HTTP requieren ejecución fuera del sandbox para abrir el puerto local.
- Frontend: 560 pruebas aprobadas (61 archivos). Calendario comprobado además con TZ=Pacific/Auckland y TZ=America/Los_Angeles; backend de calendario también con TZ=Pacific/Auckland.
- Compilación TypeScript de API a `/tmp/hu001-api-build` tras regenerar Prisma con el esquema actualizado; build Vite aprobado. Lint de ambos proyectos aprobado con advertencias preexistentes ajenas al cambio. Vite advierte del tamaño del bundle.
- Sin migraciones nuevas ni cambios de datos. No se ejecutaron suites E2E con PostgreSQL; las pruebas usan dobles de persistencia. Se conserva la selección informativa de franja y se actualiza el mensaje porque la sección Citas ya permite registrar.

## Corrección CP-001-03 del 28/11/2026

- [x] Añadir Registrar cita a la selección Disponible y transportar sucursal, fecha y hora de Ecuador al formulario existente de HU-003.
- [x] Precargar solo esos tres campos; conservar el permiso de la ruta, la validación del formulario y la revalidación del backend al guardar.
- [x] Probar destino/parámetros y recepción de datos sin registro automático; conservar casos negativos de franjas y conflictos de registro.
- [x] Verificar 568 pruebas del frontend, 212 de calendario/regresión backend y 5 integraciones con PostgreSQL temporal aislado; todas aprobadas. Base temporal eliminada al finalizar.
- [x] Validar OpenSpec estricto, build frontend, lint frontend y git diff --check. Advertencias previas de efectos React en otras secciones y tamaño del bundle; sin errores.
- Matriz reevaluada: 41/41 casos aprobados con el alcance indicado en la evidencia; revisión visual completa en navegador real aún no realizada. Verificación previa al commit y push.

## Revisión previa a publicación del 28/11/2026

- Revisados el enlace del calendario y la precarga limitada a sucursal, fecha y hora, sin escritura automática ni cambios en las reglas de registro o autorización.
- Verificados nuevamente: 568 pruebas del frontend, 278 de agendamiento backend, cinco integraciones PostgreSQL y las pruebas del enlace/precarga con TZ=Pacific/Auckland. Build del frontend y lint de ambos proyectos aprobados, con advertencias preexistentes.
- Las cinco integraciones se ejecutaron en `vet_manage_hu001_qa_20261127`, creada exclusivamente para esta revisión y eliminada al terminar.
- Limitación previa del repositorio: `prisma migrate deploy` sobre una base vacía falla en `20261119222634_agendamiento_citas`, porque referencia `patients` cuando la migración anterior todavía crea `pets`. Para validar las funcionalidades se preparó únicamente la base temporal desde el esquema actual con `prisma db push` y la secuencia `patient_code_seq`. Estas pruebas validan la integración funcional, no la cadena de migraciones. No se modificaron migraciones ni datos de desarrollo.
