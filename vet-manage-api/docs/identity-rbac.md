# Identidad y RBAC

El backend tiene modelos Prisma para usuarios, perfiles, sesiones, roles,
permisos y sus relaciones. El login/JWT y los guards se implementarán después;
esta etapa deja lista la persistencia para autenticar por roles y permisos.

## Archivos declarativos

- `src/config/permissions.catalog.ts`: fuente única de permisos.
- `src/config/roles.catalog.ts`: fuente única de roles y grants.
- `src/modules/identity/services/rbac-catalog-synchronizer.service.ts`:
  sincroniza ambos catálogos al arrancar el API.

Para agregar un permiso, añádelo a `PERMISSIONS` y asígnalo en `ROLES` si
corresponde. Para modificar su nombre, descripción o visibilidad, cambia el
catálogo. Para retirarlo, elimínalo del catálogo: la fila se conserva y se
marca `is_active = false`, y los grants dejan de aplicarse. Los roles del
catálogo se crean o actualizan; los roles de sistema retirados quedan inactivos.

El arranque de Docker ejecuta `prisma migrate deploy`, genera Prisma Client y
ejecuta la sincronización. Los cambios de estructura requieren una migración;
los cambios de roles/permisos solo requieren editar el catálogo y reiniciar el
API.

## Contrato de errores

Las excepciones usan este envelope:

```json
{
  "statusCode": 403,
  "success": false,
  "message": "Acceso denegado",
  "errors": [],
  "code": "FORBIDDEN",
  "traceId": "..."
}
```

El cliente frontend (`src/infrastructure/api/http-client.ts`) desenvuelve
`data` en respuestas exitosas y convierte los errores en `ApiError`, conservando
`code`, `errors` y `traceId`.
