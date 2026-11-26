# Tareas: HU-30 Consultar notificaciones del módulo

## 1. Base de datos

- [x] 1.1 Crear `vet-manage-api/prisma/schema/notifications.prisma` con el enum `NotificationPriority`, los modelos `NotificationType` y `Notification`, sus índices y `@@map`; agregar `notifications Notification[]` a `User` en `identity.prisma`.
  - Comando: `npx prisma validate` en `vet-manage-api`.
  - Criterio: Prisma valida el esquema y reconoce las relaciones sin errores.
- [x] 1.2 Generar la migración aditiva `add_notifications`.
  - Comando: `npx prisma migrate dev --name add_notifications`.
  - Criterio: existe una migración que crea `notification_types`, `notifications`, el enum y los índices/FKs; no altera tablas existentes.
- [x] 1.3 Regenerar el cliente Prisma y verificar que el backend compila con los nuevos tipos.
  - Comando: `npx prisma generate` y `npm run build`.
  - Criterio: el build termina sin errores y los tipos de notificación están disponibles.

## 2. Backend: API y servicios

- [x] 2.1 Crear el módulo `src/modules/notifications/` con controller, module, service, DTOs y tipos; registrarlo en `AppModule`.
  - Comando: `npm run build`.
  - Criterio: el módulo compila y la aplicación arranca sin errores de inyección.
- [x] 2.2 Implementar `GET /api/v1/notifications` y `GET /api/v1/notifications/unread-count` filtrando siempre por el `userId` del JWT.
  - Comando: `npm test -- notifications`.
  - Criterio: un usuario solo recibe sus notificaciones y el contador refleja las no leídas.
- [x] 2.3 Implementar `PATCH /api/v1/notifications/:id/read` con actualización condicional idempotente que conserve `fechaLectura`.
  - Comando: `npm test -- notifications`.
  - Criterio: marcar dos veces no cambia la fecha original y la notificación permanece en el historial.
- [x] 2.4 Implementar `GET /api/v1/notifications/:id/related-record` con validación de propiedad, mapa de permisos por `tipoEntidad` y verificación de existencia del registro.
  - Comando: `npm test -- notifications`.
  - Criterio: responde `403` sin revelar datos cuando falta permiso y `404` cuando el registro no existe.
- [x] 2.5 Agregar el endpoint de soporte `GET /api/v1/inventory/batches/:id` con `inventory:read` para la navegación a lotes.
  - Comando: `npm test -- inventory`.
  - Criterio: un usuario con `inventory:read` obtiene el lote; sin sesión recibe `401`.

## 3. Backend: pruebas

- [x] 3.1 Escribir pruebas unitarias del servicio de notificaciones para los seis escenarios de `specs/notification-consulting/spec.md` y los casos de autorización.
  - Comando: `npm test`.
  - Criterio: las pruebas cubren listado, lectura, registro relacionado, vacío, persistencia y permisos.
- [x] 3.2 Escribir pruebas de controlador/e2e para los endpoints nuevos y el aislamiento por usuario.
  - Comando: `npm run test:e2e`.
  - Criterio: los endpoints respetan el envelope y los códigos `400/401/403/404` definidos.
- [x] 3.3 Ejecutar la verificación completa del backend.
  - Comando: `npm run build`, `npm test`, `npm run lint`.
  - Criterio: build, pruebas y lint pasan sin errores.
  - Nota: build y lint pasan. `npm test` conserva un fallo preexistente y ajeno a la HU-30 en `src/config/catalogs.spec.ts` (lista de roles desactualizada).

## 4. Frontend: API, tipos y navegación

- [x] 4.1 Crear `src/modules/notifications/types.ts` y `src/modules/notifications/services/notifications-api.ts` con listado, contador, marcado de lectura y resolución del registro relacionado.
  - Comando: `npm run build` en `vet-manage-frontend`.
  - Criterio: los tipos y el cliente compilan y usan `getJson`/`patchJson` existentes.
- [x] 4.2 Agregar páginas de solo lectura para producto y lote, y registrar `/inventory/products/:id` y `/inventory/batches/:id` con `RequirePermission permission="inventory:read"`.
  - Comando: `npm run build`.
  - Criterio: ambas rutas existen y muestran los datos del registro sin acciones de edición.
- [x] 4.3 Implementar `NotificationsPanel` con estados de carga, error, vacío, contador de no leídas, lista de leídas/no leídas, detalle, marcar como leída y abrir registro relacionado.
  - Comando: `npm test -- notifications`.
  - Criterio: los estados y acciones son accesibles y no eliminan notificaciones del historial.
- [x] 4.4 Integrar el botón de notificaciones con badge en `AppShell`, visible con `inventory:read`.
  - Comando: `npm run build`.
  - Criterio: el panel se abre desde el shell y el foco se gestiona con teclado.
- [x] 4.5 Agregar estilos del panel reutilizando los tokens y patrones de `src/styles/index.css`.
  - Comando: `npm run build`.
  - Criterio: no se introducen literales de color nuevos y los estados de foco son visibles.

## 5. Frontend: pruebas

- [x] 5.1 Escribir pruebas del componente de notificaciones para los seis escenarios Gherkin, incluyendo `403` de permisos y estado vacío.
  - Comando: `npm test`.
  - Criterio: las pruebas validan renderizado, contador, marcado de lectura, persistencia simulada y navegación autorizada.
- [x] 5.2 Ejecutar la verificación completa del frontend.
  - Comando: `npm run build`, `npm test`, `npm run lint`.
  - Criterio: build, pruebas y lint pasan sin errores.

## 6. Verificación final

- [ ] 6.1 Ejecutar backend: `npm run build`, `npm test`, `npm run lint` y `npm run test:e2e`.
  - Criterio: todos los comandos terminan correctamente.
  - Nota: build y lint pasan; `npm test -- notifications` (12) y el e2e aislado de notificaciones (11) pasan. La suite e2e completa queda bloqueada porque Docker/PostgreSQL no están disponibles en el entorno.
- [x] 6.2 Ejecutar frontend: `npm run build`, `npm test`, `npm run lint`.
  - Criterio: todos los comandos terminan correctamente.
- [x] 6.3 Revisar `git status` y `git diff` para confirmar que no quedan archivos temporales ni cambios ajenos a la HU-30.
  - Criterio: solo aparecen archivos del cambio y sus pruebas.
- [x] 6.4 Validar el cambio OpenSpec y marcar las tareas completadas.
  - Comando: `openspec validate hu-30-consultar-notificaciones --strict`.
  - Criterio: el cambio es válido y todas las tareas quedan marcadas.
  - Nota: la validación estricta pasa; 6.1 queda pendiente únicamente por la falta de PostgreSQL en el entorno.
