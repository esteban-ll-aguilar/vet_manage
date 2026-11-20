# Identidad y RBAC

El backend separa los datos de la persona (`persons`) de la cuenta (`users`) y
controla el acceso con roles y permisos. La autenticación usa tokens JWT y dos
guards reutilizables por los demás módulos.

## Catálogos de permisos y roles

- `src/config/permissions.catalog.ts`: agregador público de permisos.
- `src/config/permissions/`: tres catálogos separados por módulo:
  `identity.permissions.ts`, `clinical.permissions.ts` e
  `inventory.permissions.ts`. Cada archivo es fuente de verdad de su dominio y
  usa claves `modulo:accion`.
- `src/config/roles.catalog.ts`: los 8 roles y sus permisos iniciales.
- `src/modules/identity/services/rbac-catalog-synchronizer.service.ts`:
  sincroniza ambos catálogos al arrancar la API.

La sincronización **solo crea lo que falta**. No modifica roles existentes, no
revoca asignaciones ni reactiva roles inactivos, de modo que los cambios que el
Administrador haga desde el sistema se conservan al reiniciar.

- Un rol nuevo recibe todos sus permisos del catálogo.
- Un permiso nuevo se concede a los roles que lo declaran, solo en el momento en
  que se crea.
- Un permiso que sale del catálogo se marca inactivo y sus asignaciones dejan de
  aplicarse. Si vuelve a declararse, se reactiva.

### Modo de sincronización

La variable `RBAC_SYNC_MODE` define quién manda sobre los roles del sistema:

- `create-only` (por defecto): lo descrito arriba; la base es del Administrador.
- `strict`: el catálogo manda. En cada arranque repone los datos de los roles del
  catálogo, los reactiva y deja sus asignaciones exactamente como están en el
  código (agrega las que faltan y revoca las que sobran). No toca los roles
  personalizados. Es el valor de `docker-compose.yml` en desarrollo, para que
  los cambios de permisos en el código se apliquen sin reiniciar la base.

Para agregar un permiso, añádelo al archivo del módulo correspondiente y a los
roles que corresponda. Los cambios de estructura requieren una migración; los
de permisos solo reiniciar la API.

## Administrador inicial

Al arrancar, si ningún usuario tiene el rol Administrador, se crea la persona,
la cuenta activa y la asignación del rol con las variables `ADMIN_*`. Si la
persona ya existe por cédula, se reutiliza.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `JWT_SECRET` | sí | Secreto de firma, mínimo 32 caracteres. |
| `JWT_EXPIRES_IN` | no | Vigencia del token de acceso (`15m` por defecto; ejemplos: `1h`, `7d`). |
| `SESSION_EXPIRES_IN` | no | Vigencia de la sesión renovable (`12h` por defecto). |
| `RBAC_SYNC_MODE` | no | `create-only` (por defecto) o `strict`. Ver arriba. |
| `ADMIN_EMAIL` | sí | Correo del Administrador inicial. |
| `ADMIN_PASSWORD` | sí | Mínimo 8 caracteres con mayúscula, minúscula y número. |
| `ADMIN_IDENTIFICATION` | sí | Cédula ecuatoriana válida de 10 dígitos. |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | sí | Nombres y apellidos. |
| `APP_URL` | no | Dirección pública del frontend (`http://localhost:5174` por defecto); se usa en el enlace "Iniciar sesión" de los correos. En producción debe apuntar al frontend real. |
| `SMTP_HOST`, `SMTP_PORT` | no | Servidor SMTP (`mailpit` y `51025` por defecto). |
| `SMTP_SECURE` | no | `true` para TLS directo (`false` por defecto). |
| `SMTP_USER`, `SMTP_PASSWORD` | no | Credenciales SMTP; sin usuario no se autentica. |
| `MAIL_FROM` | no | Remitente (`VetManage <no-reply@vetmanage.local>` por defecto). |

La API no arranca si falta alguna o es inválida. `docker-compose.yml` las
provee con valores de desarrollo; en producción deben definirse con valores
propios.

## Usuarios de demostración

`seed/identity.seed.ts` crea 11 cuentas de ejemplo para probar cada rol. Se
cargan junto con el seed de Inventory:

```sh
make up-seed          # o make up-podman-seed
# con la API ya levantada:
docker compose exec api npm run seed
```

Todas usan la contraseña `Vet12345`. El Administrador no forma parte del seed:
lo crea la API al arrancar con las variables `ADMIN_*`.

| Correo | Rol | Caso |
| --- | --- | --- |
| `gerente@vetmanage.local` | Gerente | |
| `veterinario@vetmanage.local`, `veterinario2@vetmanage.local` | Veterinario | |
| `tecnico@vetmanage.local` | Técnico Veterinario | |
| `recepcion@vetmanage.local` | Recepcionista | |
| `cajero@vetmanage.local` | Cajero | |
| `bodeguero@vetmanage.local` | Bodeguero | |
| `cliente@vetmanage.local` | Cliente | |
| `gerente.veterinario@vetmanage.local` | Gerente y Veterinario | Varios roles |
| `inactivo@vetmanage.local` | Recepcionista | Cuenta inactiva: no inicia sesión |
| `temporal@vetmanage.local` | Recepcionista | Contraseña temporal (`mustChangePassword`) |

El seed espera hasta 60 segundos a que la API cree los roles del sistema. Es
idempotente: personas y cuentas se actualizan por correo (la cédula se corrige si cambió), y al repetirlo
restaura la contraseña, el estado y el bloqueo de estas cuentas, útil después de
probar el bloqueo por intentos fallidos.

## Registro de usuarios

`POST /users` registra a un usuario del personal y exige el permiso
`users:create`. Recibe `identification`, `firstName`, `lastName`, `email`,
`phone` (opcional) y `roles` (nombres de rol del personal). `GET
/users/assignable-roles` devuelve los roles que se pueden asignar.

- La persona se identifica por la cédula, que se valida con el algoritmo de la
  cédula ecuatoriana (`src/common/validation/identification.ts`); sirve de
  ejemplo `1700000001`. Si ya existe y no tiene roles del personal (por ejemplo
  una cliente), se reutiliza: se conservan sus datos y se agregan los roles a su
  cuenta, sin tocar su contraseña ni enviar correo.
- La cuenta nueva queda `ACTIVE` con una contraseña temporal de 12 caracteres y
  `mustChangePassword`. Solo se guarda su hash.
- Las credenciales se envían por correo después de guardar, con una plantilla
  (`src/infrastructure/mail/templates`) que incluye los roles y un botón al
  inicio de sesión (`APP_URL`). Si el envío falla,
  la cuenta queda creada y la respuesta trae `credentialsSent: false` y el
  mensaje para reenviarlas.

| Caso | HTTP | `code` |
| --- | --- | --- |
| Campos obligatorios vacíos o sin rol | 400 | `USER_MISSING_FIELDS` |
| Cédula inválida | 400 | `USER_INVALID_IDENTIFICATION` |
| Correo, teléfono o nombre inválidos | 400 | `USER_INVALID_EMAIL`, `USER_INVALID_PHONE`, `USER_INVALID_NAME` |
| Rol inexistente, inactivo o que no es del personal | 400 | `USER_INVALID_ROLES` |
| Cédula de un usuario del personal ya registrada | 409 | `USER_IDENTIFICATION_TAKEN` |
| Correo de otra persona | 409 | `USER_EMAIL_TAKEN` |
| Sin permiso | 403 | — |

### Correo en desarrollo

`docker compose up` levanta Mailpit: el SMTP escucha en el puerto `51025` y los
correos enviados se ven en <http://localhost:58025> (`MAIL_UI_PORT`).
`MailService` (`src/infrastructure/mail`) es reutilizable por otros módulos.

## Proteger una ruta

El módulo que protege rutas debe importar `IdentityModule`.

```ts
@Get()
@RequirePermissions('clients:read')
findAll() {}
```

- `@RequirePermissions(...)` exige sesión válida y todos los permisos indicados.
- `@Authenticated()` exige solo una sesión válida.
- Las rutas sin decorador son públicas.

Respuestas: `401` sin token, con token inválido o vencido, o con cuenta
inexistente o inactiva; `403` si falta algún permiso. Los permisos se consultan
en la base de datos en cada petición (roles activos y vigentes), por lo que un
cambio del Administrador aplica sin reiniciar ni reemitir tokens.

## Auditoría

Cada acción de escritura debe dejar un registro en la tabla `audit_logs`
(fecha y hora, usuario, rol, acción, módulo y registro afectado). Se registra
dentro de la misma transacción de la acción, así que si esta falla no queda
registro, y si no se puede guardar el registro la acción tampoco se guarda.

```ts
await this.prisma.$transaction(async (tx) => {
  const species = await this.repository.create(data, tx);
  await this.audit.record(tx, {
    actorId,                        // request.user.id, desde el controlador
    action: AUDIT_ACTIONS.register,
    module: AUDIT_MODULES.species,
    affectedRecord: species.name,   // texto legible del registro
  });
  return species;
});
```

- El módulo debe importar `AuditModule` e inyectar `AuditService`.
- `record` calcula el rol con los roles activos y vigentes del actor.
- Las acciones y los módulos salen de `src/modules/audit/audit.catalog.ts`;
  agregue allí los que necesite su historia.
- Los registros son de solo lectura: un trigger de la base rechaza `UPDATE` y
  `DELETE`. Un usuario con registros de auditoría no se puede eliminar.
- Solo se auditan las escrituras. Las consultas no dejan registro.
- En las pruebas e2e que crean usuarios, límpielos con `deleteAuditLogsOfPeople`
  (`test/identity/support.ts`) antes de eliminar a los usuarios.

## Inicio de sesión y sesiones

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `POST /auth/login` | pública | Recibe `email` y `password`. Devuelve `accessToken`, `user` (datos, roles y permisos) y `mustChangePassword`, y deja el refresh token en la cookie `vetmanage_refresh`. |
| `POST /auth/refresh` | cookie | Cambia el refresh token por uno nuevo (rotación) y devuelve un token de acceso y el perfil vigente. |
| `POST /auth/logout` | cookie | Revoca la sesión y borra la cookie. |
| `GET /auth/me` | token | Perfil de la sesión con roles y permisos vigentes. |

- El token de acceso dura `JWT_EXPIRES_IN`; el frontend lo guarda solo en
  memoria y lo renueva con `/auth/refresh` cuando la API responde 401.
- El refresh token es aleatorio, se guarda como hash SHA-256 en
  `user_sessions` y viaja en una cookie `httpOnly`, `SameSite=Lax`, limitada a
  la ruta `/auth` y `Secure` en producción. Cada uso lo revoca y emite otro; un
  token usado, vencido o de una cuenta no activa responde 401.
- Tras 5 intentos fallidos consecutivos la cuenta se bloquea 15 minutos. Cada
  fallo indica los intentos restantes. Para correos no registrados se simulan
  intentos y bloqueo en Redis, así la respuesta no revela si la cuenta existe.

| Caso | HTTP | `code` |
| --- | --- | --- |
| Correo o contraseña vacíos | 400 | `LOGIN_MISSING_CREDENTIALS` |
| Correo con formato inválido | 400 | `LOGIN_INVALID_EMAIL` |
| Credenciales incorrectas | 401 | `LOGIN_INVALID_CREDENTIALS` |
| Cuenta inactiva o dada de baja | 403 | `LOGIN_ACCOUNT_DISABLED` |
| Cuenta bloqueada | 423 | `LOGIN_ACCOUNT_LOCKED` |
| Sesión renovable inválida o vencida | 401 | `SESSION_EXPIRED` |

## Contrato de errores

Las excepciones usan este envelope:

```json
{
  "statusCode": 403,
  "success": false,
  "message": "No tiene permisos para realizar esta acción",
  "errors": [],
  "code": "FORBIDDEN",
  "traceId": "..."
}
```

El cliente frontend (`src/infrastructure/api/http-client.ts`) desenvuelve
`data` en respuestas exitosas y convierte los errores en `ApiError`, conservando
`code`, `errors` y `traceId`.
