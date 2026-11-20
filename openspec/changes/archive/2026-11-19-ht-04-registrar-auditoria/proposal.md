## Why

El sistema ya registra usuarios, clientes, pacientes, especies y razas, pero no guarda quién hizo cada acción ni cuándo. La consulta de auditoría (HU-60) está planificada para un sprint posterior. Si la tabla y el registro se agregan recién entonces, se pierde todo lo ocurrido antes, y cada módulo tendría que volver a sus servicios para conectarlos. Además, el diagrama de clases exige que en las bajas "quién lo hizo quede en la auditoría". Por eso la HT-04 adelanta el registro y deja la consulta para la HU-60.

## What Changes

- Nueva tabla de auditoría según la clase `Auditoria` del diagrama: fecha y hora, usuario, rol, acción, módulo y registro afectado. Cada registro se relaciona con el usuario que hizo la acción.
- Servicio común `AuditService` para que cualquier módulo registre sus acciones dentro de la misma transacción que la acción. Si la acción falla, no queda registro.
- El rol se guarda tal como estaba al momento de la acción (los roles activos del usuario), para que cambios posteriores de roles no alteren el historial.
- Catálogo común con los nombres de las acciones y los módulos, para que los registros sean uniformes y se puedan filtrar en la HU-60.
- Los registros son de solo lectura: el servicio solo permite agregarlos y la base de datos rechaza modificarlos o eliminarlos.
- Se auditan las acciones de escritura ya entregadas:
  - Registrar usuario.
  - Asignar y quitar roles.
  - Registrar cliente.
  - Registrar paciente.
  - Registrar especie.
  - Registrar raza.
- Los endpoints de pacientes, especies y razas pasan al servicio el usuario que hace la acción, que hoy no reciben.
- Sección nueva en `vet-manage-api/docs/identity-rbac.md` sobre cómo registrar acciones en la auditoría.

Fuera de alcance:
- La consulta, los filtros y la exportación a Excel (HU-60).
- El permiso de consulta y su pantalla.
- Auditar el inicio y el cierre de sesión.
- Auditar acciones de los módulos de inventario y tienda, que lo harán sus equipos con el mismo servicio.

## Capabilities

### New Capabilities
- `audit-log`: registro de solo lectura de las acciones de los usuarios (quién, con qué rol, qué acción, en qué módulo, sobre qué registro y cuándo), atómico con la acción, y la lista de acciones que se auditan.

### Modified Capabilities
<!-- Ninguna: las acciones auditadas se definen en audit-log; los requisitos de registro de cada módulo no cambian. -->

## Impact

- **Base de datos:**
  - Nuevo archivo `prisma/schema/audit.prisma` con el modelo `AuditLog` y la relación inversa en `User`.
  - Una migración con la tabla, sus índices y un trigger que impide `UPDATE` y `DELETE`.
  - Hay que avisar al grupo, porque toca el esquema compartido.
- **API:**
  - Nuevo módulo `src/modules/audit` con `AuditService` y el catálogo de acciones y módulos.
  - Se modifican `UserRegistrationService`, `UserRoleAssignmentService` y `ClientRegistrationService` en `identity`.
  - Se modifican los servicios, repositorios y controladores de registro de paciente, especie y raza en `pets`, que son código de compañeros del grupo.
- **Pruebas:** pruebas unitarias del servicio y de cada acción auditada.
- **Documentación:** guía del equipo.
- **Sin cambios** en el frontend ni en las variables de entorno.
