## 1. Registro de cita en API

- [x] 1.1 Agregar DTO y endpoint autenticado con el permiso existente `resources:read-availability`.
- [x] 1.2 Validar relaciones, fecha, duración, tarifa, bloqueos y conflictos dentro de una transacción.
- [x] 1.3 Serializar por veterinario y consultorio para impedir reservas concurrentes.
- [x] 1.4 Reutilizar el permiso de recursos existente del rol Recepcionista, sin modificar los catálogos protegidos.

## 2. Interfaz de Recepción

- [x] 2.1 Agregar el formulario de registro con todos los campos obligatorios.
- [x] 2.2 Filtrar pacientes por cliente y consultorios por sucursal.
- [x] 2.3 Mostrar errores y confirmación con número y tarifa reservada.

## 3. Verificación

- [x] 3.1 Agregar pruebas automatizadas CP-003-01 a CP-003-09.
- [x] 3.2 Ejecutar pruebas, lint y compilaciones enfocadas de API y frontend.
