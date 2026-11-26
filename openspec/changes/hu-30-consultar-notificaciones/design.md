# Diseño: HU-30 Consultar notificaciones del módulo

## Context

HU-30 permite que Gerente y Bodeguero consulten el historial persistente de
notificaciones del módulo de Tienda/Inventario. Hoy no existe modelo de
notificaciones ni endpoints de consulta; el sistema de identidad ya aporta
`User`, roles y permisos, y el inventario ya expone productos, lotes,
categorías y marcas con el envelope `{ statusCode, success, message, data }`.

Restricciones del cambio:

- Solo se implementa la consulta del historial; la generación de notificaciones
  corresponde a otras HU.
- No se eliminan notificaciones y no se usan toasts como bandeja persistente.
- `tipoEntidad` + `entidadId` es una referencia polimórfica; no se modela como
  FK hacia varias tablas.
- Se reutilizan los patrones NestJS, Prisma, permisos y estilos existentes.

## Goals / Non-Goals

**Goals:**

- Persistir notificaciones por usuario destinatario con tipo, prioridad,
  contenido, referencia al registro relacionado y estado de lectura.
- Exponer endpoints de solo lectura para el historial del usuario autenticado,
  el contador de no leídas y el marcado idempotente como leída.
- Resolver el registro relacionado solo después de validar propiedad y permiso.
- Integrar un componente frontend accesible con estados de carga, error, vacío,
  contador de no leídas y acciones de lectura/navegación.
- Mantener el historial y `fechaLectura` tras cerrar y reabrir el componente.

**Non-Goals:**

- Generar notificaciones desde stock, vencimientos, ventas u otras HU.
- Eliminar notificaciones física o lógicamente.
- Implementar tiempo real (WebSocket/SSE) o notificaciones push.
- Crear datos de prueba masivos para otros módulos.
- Cambiar requisitos de identidad, RBAC o inventario fuera de lo necesario.

## Modelo Prisma

Se agrega `prisma/schema/notifications.prisma` y se añade la relación inversa
`notifications Notification[]` al modelo `User` de `identity.prisma`.

```prisma
enum NotificationPriority {
  CRITICA
  ALTA
  MEDIA
  BAJA
}

model NotificationType {
  id            String   @id @default(uuid()) @db.Uuid
  code          String   @unique @db.VarChar(50)
  name          String   @db.VarChar(150)
  description   String?  @db.Text
  rolesDestino  String[]
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  notifications Notification[]

  @@index([isActive])
  @@map("notification_types")
}

model Notification {
  id           String               @id @default(uuid()) @db.Uuid
  userId       String               @map("user_id") @db.Uuid
  typeId       String               @map("type_id") @db.Uuid
  tipoEntidad  String               @map("entity_type") @db.VarChar(50)
  entidadId    String               @map("entity_id") @db.VarChar(100)
  titulo       String               @db.VarChar(150)
  mensaje      String               @db.Text
  detalle      String?              @db.Text
  prioridad    NotificationPriority @default(MEDIA)
  fechaEmitida DateTime             @default(now()) @map("issued_at")
  fechaLectura DateTime?            @map("read_at")
  leida        Boolean              @default(false)
  createdAt    DateTime             @default(now()) @map("created_at")
  updatedAt    DateTime             @updatedAt @map("updated_at")

  user User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type NotificationType @relation(fields: [typeId], references: [id], onDelete: Restrict)

  @@index([userId, leida])
  @@index([userId, fechaEmitida])
  @@index([tipoEntidad, entidadId])
  @@index([typeId])
  @@map("notifications")
}
```

`leida` y `fechaLectura` se mantienen juntas: el servicio solo marca
`leida = true` y asigna `fechaLectura` cuando aún es `null`. Una notificación
leída nunca se borra ni se reescribe su `fechaLectura`.

## Extensión de base de datos

- Nueva migración `add_notifications` con el enum, las tablas
  `notification_types` y `notifications`, sus índices y FKs.
- `userId` referencia `users(id)` con `ON DELETE CASCADE`.
- `typeId` referencia `notification_types(id)` con `ON DELETE RESTRICT`.
- `entidadId` se almacena como texto porque la referencia es polimórfica y no
  todas las entidades relacionadas tienen que ser UUID.
- No hay backfill: los usuarios existentes comienzan con historial vacío.
- Los tipos de notificación son datos de referencia que crearán las HU
  generadoras; esta HU no siembra datos masivos.

## API y servicios

Nuevo módulo `src/modules/notifications/` con controller, module, service,
DTOs y tipos, registrado en `AppModule`.

Endpoints bajo `/api/v1`:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/notifications` | Lista las notificaciones del usuario autenticado, ordenadas por `fechaEmitida` descendente. Acepta `?unreadOnly=true` y `?take=` (máximo 100). |
| `GET` | `/notifications/unread-count` | Devuelve `{ unreadCount }` para el usuario autenticado. |
| `PATCH` | `/notifications/:id/read` | Marca una notificación propia como leída. Idempotente. |
| `GET` | `/notifications/:id/related-record` | Valida propiedad y permiso y devuelve `{ tipoEntidad, entidadId, route }`; no revela el registro si falla la autorización. |

Servicio:

- Todas las consultas incluyen `where: { userId }` obtenido del JWT; el cliente
  nunca envía el usuario destinatario.
- `markAsRead` usa una actualización condicional atómica:
  `updateMany({ where: { id, userId, leida: false }, data: { leida: true, fechaLectura: new Date() } })`.
  Si no actualiza, verifica existencia y propiedad; si ya estaba leída,
  devuelve el registro sin cambios. Esto evita carreras entre pestañas.
- El contador de no leídas se calcula con `count({ where: { userId, leida: false } })`.
- La lista serializa fechas como ISO y no expone relaciones internas de Prisma.

## Autorización

- `GET /notifications`, `GET /notifications/unread-count` y
  `PATCH /notifications/:id/read` usan `@RequirePermissions('inventory:read')`,
  permiso que ya tienen Gerente y Bodeguero.
- La propiedad se valida en la consulta; una notificación de otro usuario se
  responde como `404 NOTIFICATION_NOT_FOUND` para no filtrar su existencia.
- `GET /notifications/:id/related-record` valida en este orden:
  1. Sesión válida.
  2. Notificación existente y perteneciente al usuario.
  3. Permiso del tipo de entidad mediante `AccessService.getPermissionKeys`.
  4. Existencia y estado activo del registro relacionado.
- Mapa de permisos por entidad:

| `tipoEntidad` | Permiso requerido | Ruta destino |
|---|---|---|
| `PRODUCT` | `inventory:read` | `/inventory/products/:id` |
| `BATCH` | `inventory:read` | `/inventory/batches/:id` |
| `CATEGORY` | `inventory:read` | `/inventory/categories` |
| `BRAND` | `inventory:read` | `/inventory/brands` |

- El frontend usa `hasPermission` y `RequirePermission` para ocultar o proteger
  acciones, pero la autorización real siempre la aplica el backend.

## Referencia polimórfica

- `tipoEntidad` es un valor de una lista permitida (`PRODUCT`, `BATCH`,
  `CATEGORY`, `BRAND`); cualquier otro valor responde
  `400 UNSUPPORTED_ENTITY_TYPE`.
- `entidadId` se interpreta según `tipoEntidad` dentro del resolver del backend.
- No se crean FKs múltiples ni relaciones opcionales; se respeta la indicación
  del diagrama de clases.
- Las notificaciones sobreviven si el registro relacionado se desactiva o
  elimina; en ese caso el resolver responde `404 RELATED_ENTITY_NOT_FOUND` y la
  notificación permanece visible en el historial.
- Se indexa `(tipoEntidad, entidadId)` para resolver el registro sin recorrer
  todas las notificaciones.

## Rutas de registro relacionado

Para cumplir el escenario 3 con rutas existentes y nuevas dentro del alcance:

- `PRODUCT`: nueva página de solo lectura `/inventory/products/:id` que usa el
  endpoint existente `GET /inventory/products/:id`.
- `BATCH`: nueva página de solo lectura `/inventory/batches/:id` y endpoint de
  soporte `GET /api/v1/inventory/batches/:id` con `inventory:read`.
- `CATEGORY` y `BRAND`: reutilizan las rutas existentes
  `/inventory/categories` y `/inventory/brands`.
- Las rutas nuevas se envuelven con `RequirePermission permission="inventory:read"`.
- El backend devuelve la ruta resuelta; el frontend no construye rutas con datos
  no autorizados.

## Estados e interacción frontend

- Nuevo módulo `src/modules/notifications/` con:
  - `types.ts`: `Notification`, `NotificationPriority`, `RelatedRecord`.
  - `services/notifications-api.ts`: listado, contador, marcar leída y resolver
    registro relacionado usando `getJson`/`patchJson`.
  - `components/notifications-panel.tsx` y estilos propios.
- Integración en `AppShell`: botón de campana con badge de no leídas junto al
  menú de usuario; abre un panel/drawer reutilizando los estilos de modal
  existentes. Visible solo con `inventory:read`.
- Al abrir el panel se cargan lista y contador. No hay polling ni tiempo real;
  se refresca al abrir, al marcar leída y al reintentar un error.
- Estados:
  - **Carga**: mensaje o skeleton con `aria-busy="true"`.
  - **Error**: mensaje comprensible y botón `Reintentar`.
  - **Vacío**: mensaje indicando que no existen notificaciones.
  - **Lista**: título, fecha de emisión, estado leída/no leída, mensaje, detalle
    expandible, prioridad y botón de registro relacionado.
- Cada notificación no leída muestra `Marcar como leída` con `aria-label`
  descriptivo. La acción actualiza el estado local y el contador sin quitar el
  elemento del historial.
- El botón de registro relacionado llama al endpoint de validación. Si responde
  `403`, muestra un aviso `role="alert"` con el mensaje de permisos
  insuficientes y no navega. Si responde `404`, informa que el registro ya no
  está disponible.
- Accesibilidad: foco visible, cierre con `Escape`, foco inicial en el panel,
  retorno de foco al botón, `aria-expanded`, `aria-controls`, `aria-live` para
  cambios de estado y textos de error claros.
- Colores y tipografía se toman de los tokens de `src/styles/index.css`; no se
  introducen literales de color nuevos. Toast solo para errores transitorios.

## Contratos de error

Todas las respuestas usan el envelope existente:

```json
{
  "statusCode": 403,
  "success": false,
  "message": "No tiene permisos suficientes para consultar el registro relacionado",
  "errors": [],
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

| HTTP | Código | Cuándo |
|---|---|---|
| `400` | `UNSUPPORTED_ENTITY_TYPE` | `tipoEntidad` no está en la lista permitida. |
| `400` | `INVALID_NOTIFICATION_ID` | El `id` no es un UUID válido. |
| `401` | `UNAUTHENTICATED` | No hay sesión válida. |
| `403` | `INSUFFICIENT_PERMISSIONS` | El usuario no tiene el permiso del registro relacionado. |
| `404` | `NOTIFICATION_NOT_FOUND` | No existe o no pertenece al usuario autenticado. |
| `404` | `RELATED_ENTITY_NOT_FOUND` | El registro relacionado no existe o está inactivo. |

## Migración y compatibilidad

- Ejecutar `npx prisma migrate dev --name add_notifications` para generar la
  migración y luego `npx prisma generate` para actualizar el cliente.
- En despliegue: `npx prisma migrate deploy`.
- La migración es aditiva: crea enum, tablas, índices y FKs; no altera tablas
  existentes salvo la relación virtual de Prisma en `User`.
- Rollback: al no haber datos previos dependientes, se pueden eliminar
  `notifications`, `notification_types` y el enum en una migración inversa sin
  afectar identidad ni inventario.
- Los endpoints existentes no cambian; el nuevo módulo se registra en
  `AppModule` y reutiliza `PrismaModule` e `IdentityModule`.
- Compatibilidad PostgreSQL: UUID, `text[]` para `rolesDestino`, enum nativo y
  `timestamp(3)` siguiendo las convenciones actuales de Prisma.

## Decisions

- **Reutilizar `inventory:read`** en lugar de crear `notifications:read`: los
  actores ya lo tienen y se evita una migración de catálogo RBAC. Alternativa
  descartada: permiso nuevo, que exigiría actualizar roles y seeds.
- **Validar el registro relacionado en backend**: evita revelar rutas o datos
  antes de autorizar. Alternativa descartada: resolver solo en frontend, que no
  protege la API.
- **Modelo `NotificationType` y enum `NotificationPriority`**: siguen el
  diagrama de clases y permiten `rolesDestino` sin recurrir a un enum rígido
  para los tipos.
- **Actualización condicional para marcar leída**: garantiza idempotencia y
  evita sobrescribir `fechaLectura`. Alternativa descartada: leer y luego
  escribir, propensa a carreras.
- **Panel/drawer en AppShell**: mantiene el contexto de la pantalla actual y
  reutiliza los estilos de modal. Alternativa descartada: página completa, que
  agrega navegación innecesaria para esta HU.
- **Páginas de detalle mínimas para producto y lote**: permiten cumplir la
  navegación al registro sin convertir la notificación en un enlace muerto.

## Risks / Trade-offs

- **Referencias polimórficas obsoletas** → el resolver valida existencia y
  responde un error claro; la notificación permanece en el historial.
- **Deriva entre permisos de frontend y backend** → el backend siempre
  revalida; el frontend solo mejora la experiencia.
- **Crecimiento del historial** → índices por usuario/estado y límite `take`
  máximo de 100; la paginación por cursor queda como mejora futura.
- **Pérdida de foco o navegación accidental en el drawer** → manejo de foco,
  `Escape`, `aria-modal` y bloqueo de navegación hasta recibir autorización.
- **Alcance de las páginas de detalle** → se limitan a lectura y a los campos
  necesarios para identificar el registro; no agregan edición ni otras HU.
