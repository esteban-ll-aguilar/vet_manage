# HU-001 Consultar calendario de citas

## Why
La recepcionista necesita consultar citas y disponibilidad por sucursal, incluso en fechas históricas.

## What Changes
- Lectura de calendario día/semana/mes, detalle y franjas de 30 minutos.
- Permiso `calendar:read` para recepcionista (superadmin lo hereda por catálogo).
- Interfaz accesible con etiquetas de estado, filtros locales y navegación temporal.
- Continuación desde una franja disponible al formulario existente de HU-003 con sucursal, fecha y hora precargadas.

## Non-goals
La consulta del calendario no registra reservas, migra ni escribe datos. La integración con HU-003 se limita a precargar su formulario existente; el registro conserva sus reglas y validaciones. La regla histórica de config.yaml sobre limitar propuestas a fundación técnica se exceptúa por la solicitud explícita de implementar HU-001. No se modifican otros cambios OpenSpec.

## Impact
Submódulo calendar nuevo, registro mínimo de módulo, permiso, rol, ruta y navegación.
