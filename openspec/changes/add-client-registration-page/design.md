## Context

El backend ya expone `POST /api/v1/clients` y `GET /api/v1/clients/assignable-roles` (ambos protegidos con `clients:create`), implementados en `vet-manage-api` dentro del módulo de identidad. El DTO de registro acepta `identification`, `firstName`, `lastName`, `email`, `phone?`, `address?` y un campo `roles?` que se ignora en la asignación (el servicio siempre asigna el rol `client`).

En el frontend, la ruta `/clients` renderiza hoy un componente inline `ComingSoonPage` definido en `src/app/router.tsx`, sin guarda de permisos. La navegación lateral ya incluye el enlace "Clientes" con `permission: 'clients:read'`. Las páginas `/users` y `/users/new` contienen el diseño y los componentes que se deben reutilizar: encabezados de página, tarjetas de registro, el componente local `Field`, validadores, toasts y el patrón de envío/manejo de errores.

Restricciones relevantes:
- No se modifica el backend; solo se consume su contrato actual.
- No se agregan dependencias de testing de DOM (no hay `@testing-library/react` ni `jsdom`); las pruebas existentes son unitarias con `vitest`.
- Se debe mantener la coherencia visual con `/users` y `/users/new`.

## Goals / Non-Goals

**Goals**
- Reemplazar el placeholder de `/clients` por una pantalla con el diseño de `/users`, con el botón "Nuevo cliente" (equivalente a "Nuevo usuario").
- Exponer `/clients/new` con el formulario de registro adaptado de `/users/new`, enfocado únicamente en clientes.
- Mostrar la sección de datos del cliente (incluyendo dirección) y una sección de roles con el rol `client` preseleccionado y no editable.
- Enviar el alta a `POST /api/v1/clients`, mostrando estados de carga, éxito y error.
- Proteger el acceso con `clients:read` (listado) y `clients:create` (alta).
- Cubrir la lógica pura del formulario y del cliente HTTP con pruebas unitarias.

**Non-Goals**
- Implementar el listado real de clientes (la lista en `/users` también es placeholder y se mantiene así).
- Modificar catálogos de roles/permisos, el backend, ni el diseño global.
- Permitir la selección de roles del personal o la asignación manual de roles.
- Agregar edición, eliminación ni detalle de clientes.

## Decisions

**1. Reutilizar componentes y estilos en lugar de crear una librería compartida.**
Se copia/adapta el patrón de `user-register-page.tsx` (layout, `Field`, CSS `register-card`, `role-card`, Patrón de toast y submit) hacia un módulo `clients`. Se mantienen los nombres de clases CSS existentes para no alterar el diseño. Se descartó extraer componentes compartidos porque implicaría refactorizar `/users` fuera del alcance y aumentaría el riesgo de regresión visual.

**2. Formulario de cliente con su propio módulo y rutas de API.**
Se crea `src/modules/clients/` con:
- `pages/clients-page.tsx` + `clients-page.css` (equivalente a `/users`).
- `pages/client-register-page.tsx` + `client-register-page.css` (equivalente a `/users/new`).
- `form-rules.ts` (validación y mapeo de errores, derivado de `users/form-rules.ts`).
- `services/clients-api.ts` (uso de `postJson`/`getJson` con las rutas `/clients`).
- `types.ts` (`RegisterClientInput`, `RegisteredClient`, `AssignableRole`).

Se reutilizan `isValidIdentification` de `src/common/validation/identification.ts`, los iconos de `common/components/icons.tsx` y `useToast`. Se descartó reutilizar `usersApi` y `users/form-rules.ts` directamente porque sus reglas de error (`USER_*`), su endpoint (`/users`) y sus roles (`STAFF`) no aplican a clientes.

**3. Rol `client` fijo y no editable en la UI.**
El backend ignora los roles enviados y siempre asigna `client`, por lo que la sección de roles del formulario mostrará una única tarjeta seleccionada y deshabilitada con el rol `client` (usa `GET /clients/assignable-roles` para obtener `displayName`/`description`, con fallback a un valor por defecto si falla la carga). El payload enviado incluirá `roles: ['client']` para compatibilidad con el DTO. Alternativa descartada: reutilizar el selector múltiple de `/users/new`, ya que mostraría roles del personal y permitiría selecciones que el backend no respeta.

**4. Campo de dirección incluido.**
El DTO de cliente soporta `address?`, a diferencia del de usuario. Se agrega un campo "Dirección" (opcional, `maxLength=255`) a la sección de datos, manteniendo el mismo estilo `Field`. Se descartó omitirlo para no perder información que el backend ya persiste.

**5. Guardas de permisos en las rutas.**
Se envuelve `/clients` con `RequirePermission permission="clients:read"` y `/clients/new` con `RequirePermission permission="clients:create"`, coherente con el backend y con el patrón ya usado en `/users`. El botón "Nuevo cliente" se muestra solo si `hasPermission('clients:create')`.

**6. Pruebas unitarias sobre lógica pura.**
Se añaden pruebas `vitest` para `clients/form-rules.ts` (validación de campos, mapeo de códigos `CLIENT_*`, mensajes de éxito/Error de correo) y se verifica la forma del payload del cliente. No se introducen dependencias de renderizado por no existir en el proyecto; la cobertura de UI se sustituye por pruebas de las funciones puras que alimentan la pantalla.

**7. Correcciones mínimas de backend detectadas durante la verificación.**
`clients.controller.ts` importaba `ClientRegistrationDto` con `import type`, por lo que el metadata `design:paramtypes` se emitía como `Function` y la `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`) rechazaba cada campo con 400. Se cambia a import de valor, igual que `users.controller.ts`. Además, `identity.prisma` declara `Person.address` desde el commit de registro de clientes, pero ninguna migración creaba la columna, lo que hacía fallar `POST /clients` y `GET /clients` con `P2022`; se agrega `20261119150000_add_person_address`. Alternativa descartada: dejar el backend intacto y entregar una UI que no puede guardar ni listar clientes.

## Risks / Trade-offs

- [El backend ignora `roles`] → La UI muestra el rol `client` como preseleccionado y no editable; se envía `roles: ['client']` solo por compatibilidad, evitando dar la impresión de que se pueden asignar otros roles.
- [Sin pruebas de renderizado] → Se cubre la lógica pura (validación, mapeo de errores, payload). Riesgo residual: errores de maquetación solo detectables manualmente en `http://localhost:5174/clients/new`; se mitiga reutilizando CSS y markup existentes.
- [Fallo al cargar `/clients/assignable-roles`] → Se usa un rol `client` por defecto para no bloquear el formulario; el alta no depende de esta carga.
- [Cédula duplicada / correo duplicado] → El mapeo de `CLIENT_IDENTIFICATION_TAKEN` y `CLIENT_EMAIL_TAKEN` asocia el error al campo correspondiente y mantiene los datos ingresados.
- [Cambio de diseño en `/users`] → Al duplicar estilos en lugar de compartirlos, un futuro cambio en `/users` no se propaga automáticamente; se acepta para limitar el alcance del cambio.

## Migration Plan

1. Crear el módulo `clients` en el frontend con páginas, estilos, reglas de formulario, tipos y servicio HTTP.
2. Registrar las rutas `/clients` y `/clients/new` con sus guardas en `src/app/router.tsx`, reemplazando el `ComingSoonPage` de `/clients`.
3. Ejecutar `npm run lint`, `npm run test` y `npm run build` en `vet-manage-frontend`.
4. Verificar manualmente en `http://localhost:5174/clients` y `/clients/new` con un usuario que tenga `clients:read` y `clients:create`.
5. Rollback: revertir los archivos del módulo `clients` y restaurar la ruta original en `router.tsx`; no hay cambios de base de datos ni de backend.

## Open Questions

- ¿Debe el listado de `/clients` mostrar próximamente los clientes reales consumiendo `GET /api/v1/clients`? Está fuera del alcance de este cambio (la lista de `/users` también es placeholder), pero podría abordarse en un cambio posterior.
- ¿Se desea mostrar el mensaje de "contraseña temporal enviada por correo" tal como en `/users/new`, o un aviso específico para clientes? Se reutiliza el patrón de `registrationOutcome` adaptado a mensajes `CLIENT_*`.
