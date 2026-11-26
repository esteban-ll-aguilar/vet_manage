## Context

El diagrama de clases define `Auditoria` con los campos fecha y hora, rol, acción, módulo y registro afectado, y una relación `Auditoria "0..*" --> "1" Usuario`. La matriz de roles y permisos dice que nadie puede modificar ni eliminar sus registros.

Hoy hay seis acciones de escritura entregadas:
- En `identity`: registrar usuario, asignar roles y registrar cliente. Ya usan `prisma.$transaction` y reciben el `actorId` desde el controlador.
- En `pets`: registrar paciente, especie y raza. Usan repositorios que escriben con `PrismaService` directamente, sin transacción, y sus controladores no pasan el usuario autenticado.

El esquema de Prisma está dividido por archivos (`identity.prisma`, `pets.prisma`, `inventory.prisma`). Lo editan varios equipos, así que conviene tocar lo mínimo de los archivos ajenos.

## Goals / Non-Goals

**Goals:**
- Tabla y servicio de auditoría reutilizables por cualquier módulo, también los de otros equipos.
- Garantizar que el registro y la acción se guardan juntos o no se guardan.
- Registros inmutables también a nivel de base de datos.
- Auditar las seis acciones de escritura ya entregadas.

**Non-Goals:**
- Endpoint de consulta, filtros, paginación y exportación (HU-60).
- Auditar inicio o cierre de sesión, lecturas o acciones fallidas.
- Guardar el detalle del cambio (valores anteriores y nuevos): el diagrama no lo modela.

## Decisions

### 1. Modelo `AuditLog` en un archivo propio `audit.prisma`

| Campo | Columna | Tipo |
|---|---|---|
| `id` | `id` | UUID |
| `occurredAt` | `occurred_at` | `DateTime`, por defecto `now()` |
| `userId` | `user_id` | UUID, FK a `User` con `onDelete: Restrict` |
| `role` | `role` | `VarChar(255)` |
| `action` | `action` | `VarChar(50)` |
| `module` | `module` | `VarChar(50)` |
| `affectedRecord` | `affected_record` | `VarChar(255)` |

- La tabla es `audit_logs` y tiene índices en `occurredAt`, `userId` y `(module, action)`, pensando en los filtros de la HU-60.
- En `identity.prisma` solo se agrega la relación inversa `auditLogs AuditLog[]` en `User`.
- Los nombres en inglés siguen la convención del esquema (`Person`, `User`); los campos son exactamente los del diagrama.
- `Restrict` cumple que los registros sobrevivan a la baja: la baja de un usuario es un cambio de estado, y el borrado físico queda bloqueado si tiene auditoría.
- *Alternativa descartada:* poner el modelo en `identity.prisma`. Aumenta los conflictos con otros cambios sobre ese archivo.

### 2. Inmutabilidad con un trigger en la migración

La migración crea una función y un trigger `BEFORE UPDATE OR DELETE` en `audit_logs` que lanza una excepción. Además, el servicio solo expone `record`.

- *Alternativa descartada:* confiar solo en que la aplicación no ofrezca editar ni borrar. No impide que otro módulo, un script o un `prisma.auditLog.delete` lo hagan, y la matriz pide que "nadie" pueda.
- `TRUNCATE` no activa triggers de fila, así que `prisma migrate reset` y las limpiezas de pruebas siguen funcionando.

### 3. Módulo `audit` con `AuditService.record(tx, entry)`

Se crea `src/modules/audit/` con:
- `audit.module.ts`, que exporta `AuditService`;
- `audit.catalog.ts`, con las constantes `AUDIT_ACTIONS` y `AUDIT_MODULES`;
- `services/audit.service.ts`.

La firma es:

```ts
record(tx: Prisma.TransactionClient, entry: { actorId: string; action: AuditAction; module: AuditModule; affectedRecord: string }): Promise<void>
```

- El primer parámetro obliga a quien llama a pasar el cliente de su transacción, así el registro siempre comparte la transacción con la acción (spec "Atomic with the action").
- Es un módulo aparte, no parte de `identity`, para que la HU-60 agregue ahí su controlador y para que los módulos de otros equipos dependan solo de la auditoría.
- `AuditModule` solo importa `PrismaModule`, así que no hay dependencias circulares.
- *Alternativa descartada:* un interceptor de Nest que audite por endpoint. Corre fuera de la transacción del servicio, no conoce el registro afectado y registraría también peticiones que fallan después.

### 4. El rol se calcula dentro de `record`

`record` consulta con el mismo `tx` los roles activos y vigentes del actor (`isActive` y `expiresAt` nulo o futuro), toma su `displayName`, los ordena alfabéticamente y los une con `", "`.

- Así ningún módulo tiene que conocer los roles del usuario.
- *Alternativa descartada:* pasar el rol desde el JWT o la petición. El token no lleva roles y exigirlo a cada controlador repetiría código.

### 5. Catálogo de acciones y módulos

```ts
AUDIT_ACTIONS = { register: 'Registrar', assignRoles: 'Asignar roles' }
AUDIT_MODULES = { users: 'Usuarios', clients: 'Clientes', patients: 'Pacientes', species: 'Especies', breeds: 'Razas' }
```

- Se guardan los textos en español porque son lo que verá y filtrará el Administrador en la HU-60.
- Los tipos `AuditAction` y `AuditModule` se derivan de los valores, así que un texto fuera del catálogo no compila.
- Cada HU futura agrega lo que necesite, por ejemplo "Inactivar", "Activar" o "Dar de baja".
- *Alternativa descartada:* un `enum` de Prisma. Cada acción nueva exigiría una migración.

### 6. Texto del registro afectado

Lo arma quien llama, con datos que ya tiene en la transacción:

| Módulo | Formato |
|---|---|
| Usuarios y Clientes | `<cédula> - <nombres> <apellidos>` |
| Pacientes | `<nombre del paciente> (<código del paciente>)` |
| Especies | `<nombre>` |
| Razas | `<nombre> (<especie>)` |

El diagrama define el campo como texto legible. No se agrega el id del registro para no salir del diagrama.

### 7. Cambios en las acciones existentes

- **`UserRegistrationService` y `ClientRegistrationService`:** llaman a `audit.record(tx, ...)` al final de su `persist`, dentro de la transacción que ya existe. El envío de correo sigue fuera.
- **`UserRoleAssignmentService.update`:** calcula primero los roles a agregar, renovar y quitar; si hay alguno, registra "Asignar roles" antes de aplicar los cambios, para que el rol guardado sea el que tenía el actor, y si no hay ninguno no registra nada (escenario "Roles unchanged").
- **Registro de paciente, especie y raza:**
  - Los controladores pasan `request.user.id` como `actorId` a `execute`.
  - Los servicios envuelven el `create` y el `record` en `prisma.$transaction`.
  - Los repositorios aceptan un cliente opcional (`tx`) en `create`, y por defecto usan `PrismaService`.
  - Las validaciones previas quedan fuera de la transacción, como están hoy.
- **Módulos:** `IdentityModule` y `PetsModule` importan `AuditModule`.

## Risks / Trade-offs

- **[Riesgo]** Cambiar la firma de `execute` en los servicios de `pets` rompe las pruebas y el código de compañeros. → **Mitigación:** cambio mínimo (un parámetro `actorId` y el `tx` opcional en `create`), actualizar sus pruebas en este mismo PR y avisar al grupo.
- **[Riesgo]** Conflictos en `identity.prisma` y en la carpeta de migraciones con otras ramas. → **Mitigación:** el modelo va en `audit.prisma`, la migración tiene marca de tiempo propia y el cambio se comunica antes de subirlo.
- **[Riesgo]** Una consulta extra de roles en cada acción auditada. → **Mitigación:** es una consulta indexada por `userId` y solo ocurre en escrituras; es aceptable.
- **[Trade-off]** El registro afectado es solo texto: si el nombre cambia luego, el registro conserva el nombre de entonces. Es lo deseado en una auditoría.
- **[Trade-off]** El trigger impide corregir un registro mal escrito, incluso al desarrollador. Si hace falta, se hace con una migración explícita que lo desactive temporalmente.

## Migration Plan

1. Agregar `audit.prisma` y la relación en `User`, y generar la migración con `prisma migrate dev --create-only`.
2. Agregar a mano en el SQL de la migración la función y el trigger, y luego aplicarla.
3. Al desplegar, `prisma migrate deploy` crea la tabla vacía. No hay datos que migrar.
4. Rollback: una migración que elimine el trigger, la función y la tabla. Las acciones vuelven a funcionar quitando las llamadas a `record`.

## Open Questions

- Ninguna bloqueante. Queda por decidir con el grupo si el inicio de sesión se audita más adelante; no está en las HU actuales.
