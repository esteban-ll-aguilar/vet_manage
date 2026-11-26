# Propuesta: HU-30 Consultar notificaciones del módulo

## Why

El módulo de Tienda/Inventario ya genera alertas operativas (stock bajo,
vencimientos, movimientos), pero no existe una bandeja persistente donde
Gerente y Bodeguero puedan revisarlas. Sin un historial consultable, las
alertas se pierden y el usuario no puede acceder al registro que las originó.
Esta HU entrega únicamente la consulta del historial; las HU que generan las
notificaciones quedan fuera de alcance.

## What Changes

- Agregar persistencia de notificaciones por usuario destinatario, con tipo,
  prioridad, título, mensaje, detalle, entidad relacionada, fecha de emisión,
  estado de lectura y fecha de lectura.
- Exponer endpoints REST bajo `/api/v1` para listar las notificaciones del
  usuario autenticado, contar las no leídas y marcar una notificación como
  leída.
- Validar la autorización del usuario antes de resolver y abrir el registro
  relacionado, sin revelarlo cuando no tiene permiso.
- Agregar un componente de notificaciones integrado en el frontend (AppShell o
  ubicación visible para Gerente y Bodeguero) con estados de carga, error,
  vacío, contador de no leídas y acciones de lectura/navegación.
- Reutilizar los patrones existentes de NestJS, Prisma, permisos y estilos del
  repositorio.
- Cubrir los seis escenarios Gherkin de HU-30 con pruebas de backend y
  frontend.

## In Scope

- Consulta de notificaciones del usuario autenticado.
- Visualización de título, fecha, estado de lectura, mensaje, detalle y
  registro relacionado.
- Marcado de una notificación como leída conservándola en el historial.
- Persistencia de notificaciones y de su estado de lectura.
- Apertura del registro relacionado solo si el usuario posee permiso.
- Mensaje de estado vacío y mensaje de permisos insuficientes.
- Componente visual, API client y tipos TypeScript del frontend.
- Migración y modelos Prisma necesarios.
- Pruebas de backend y frontend para los seis escenarios.

## Out of Scope

- Las HU que generan las notificaciones.
- Creación masiva de datos de prueba para otros módulos.
- Notificaciones temporales o tipo Toast como sustituto del historial.
- Eliminación física de notificaciones.
- Referencias polimórficas implementadas como relaciones FK hacia varias
  entidades.
- Cambios ajenos al módulo de Tienda/Inventario.

## Success Criteria

- Todos los escenarios de `specs/notification-consulting/spec.md` pasan.
- El usuario solo puede consultar sus propias notificaciones.
- Una notificación leída conserva su `fechaLectura` y permanece en el
  historial tras cerrar y reabrir el componente.
- El contador de no leídas refleja el estado persistido.
- El sistema muestra un mensaje cuando no existen notificaciones.
- El acceso a un registro relacionado se bloquea con un mensaje de permisos
  insuficientes cuando el usuario no está autorizado.
- Build, tests y lint de backend y frontend pasan.

## Capabilities

### New Capabilities

- `notification-consulting`: consulta persistente de notificaciones del
  usuario autenticado, marcado como leído sin eliminación y navegación segura
  al registro relacionado según permisos.

### Modified Capabilities

Ninguna. No se modifican requisitos de capacidades existentes.

## Impact

- **Backend**: nuevos modelos y migración Prisma para notificaciones;
  módulo de notificaciones con repositorio, DTOs, servicio, controlador y
  validación de autorización reutilizando el sistema de permisos existente.
- **API**: endpoints bajo `/api/v1` para listado, contador de no leídas,
  marcado como leído y verificación de acceso al registro relacionado.
- **Frontend**: API client, tipos, componente de notificaciones integrado en
  el shell, estilos con los tokens existentes y ajustes de router solo si son
  necesarios para la navegación.
- **Datos**: nuevas tablas para notificación y su clasificación; relación
  persistente con `User` de `identity.prisma`.
- **Permisos**: se reutilizan `hasPermission` y `RequirePermission`; no se
  introduce un modelo de autorización paralelo.
- **Pruebas**: suites de backend y frontend para los seis escenarios Gherkin.
