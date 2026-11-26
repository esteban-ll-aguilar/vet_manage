## 1. Estructura del módulo de clientes en el frontend

- [x] 1.1 Crear el directorio `vet-manage-frontend/src/modules/clients/` con las carpetas `pages/` y `services/`
- [x] 1.2 Crear `src/modules/clients/types.ts` con `RegisterClientInput`, `RegisteredClient` y `AssignableRole` (incluyendo `address?` y `roles: ['client']`)
- [x] 1.3 Crear `src/modules/clients/services/clients-api.ts` con `register()` usando `postJson('/clients', ...)` y `assignableRoles()` usando `getJson('/clients/assignable-roles')`, reutilizando el cliente HTTP existente

## 2. Reglas de formulario y validación

- [x] 2.1 Crear `src/modules/clients/form-rules.ts` derivado de `users/form-rules.ts`, con `validateRegistration` para identification, firstName, lastName, email, phone y address
- [x] 2.2 Reutilizar `isValidIdentification` de `src/common/validation/identification.ts` y mantener validación de correo y teléfono
- [x] 2.3 Implementar `describeApiError` para los códigos `CLIENT_MISSING_FIELDS`, `CLIENT_INVALID_IDENTIFICATION`, `CLIENT_INVALID_EMAIL`, `CLIENT_INVALID_PHONE`, `CLIENT_INVALID_ADDRESS`, `CLIENT_IDENTIFICATION_TAKEN` y `CLIENT_EMAIL_TAKEN`, asociando el error al campo correspondiente
- [x] 2.4 Implementar `registrationOutcome` con los mensajes de éxito y de fallo de correo del registro de clientes (`Cliente registrado correctamente` / `Cliente registrado, pero no se pudo enviar el correo…`)

## 3. Página de clientes y botón "Nuevo cliente"

- [x] 3.1 Crear `src/modules/clients/pages/clients-page.tsx` replicando el diseño de `users-page.tsx` (encabezado "Clientes", eyebrow "Administración", descripción y tarjeta placeholder de listado)
- [x] 3.2 Reemplazar el botón "Nuevo usuario" por un `Link` a `/clients/new` con etiqueta "Nuevo cliente", mostrado solo cuando `hasPermission('clients:create')`
- [x] 3.3 Crear `src/modules/clients/pages/clients-page.css` reutilizando los estilos de `users-page.css`

## 4. Formulario de registro de cliente en /clients/new

- [x] 4.1 Crear `src/modules/clients/pages/client-register-page.tsx` adaptado de `user-register-page.tsx`, con encabezado "Usuarios / Registrar cliente" y enlace de retorno a `/clients`
- [x] 4.2 Mostrar la sección "Datos del cliente" con los campos cédula, nombres, apellidos, correo electrónico, teléfono (opcional) y dirección (opcional), usando el componente local `Field` y los mismos iconos/clases
- [x] 4.3 Mostrar la sección de roles con una única tarjeta de rol `client` preseleccionada y no editable, obteniendo `displayName`/`description` de `clientsApi.assignableRoles()` con fallback a valores por defecto si falla la carga
- [x] 4.4 Enviar el formulario con `clientsApi.register({ identification, firstName, lastName, email, phone?, address?, roles: ['client'] })` y establecer `saving` durante la petición
- [x] 4.5 Mostrar el resultado con `useToast` usando `registrationOutcome`, navegar a `/clients` en caso de éxito y mantener los datos y el error en caso de fallo
- [x] 4.6 Cambiar el botón principal a "Guardar cliente" y el de cancelación a "Cancelar" con destino `/clients`
- [x] 4.7 Crear `src/modules/clients/pages/client-register-page.css` copiando/ajustando los estilos de `user-register-page.css`

## 5. Rutas y control de acceso

- [x] 5.1 Importar `ClientsPage` y `ClientRegisterPage` en `src/app/router.tsx` y eliminar el uso de `ComingSoonPage` para `/clients`
- [x] 5.2 Registrar la ruta `/clients` envuelta en `RequirePermission permission="clients:read"`
- [x] 5.3 Registrar la ruta `/clients/new` envuelta en `RequirePermission permission="clients:create"`
- [x] 5.4 Verificar que el enlace "Clientes" del `AppShell` siga basado en `clients:read` y que no se modifique la navegación existente

## 6. Pruebas

- [x] 6.1 Crear `src/modules/clients/form-rules.test.ts` con casos válidos e inválidos para cédula, correo, teléfono y dirección, y campos obligatorios faltantes
- [x] 6.2 Cubrir el mapeo de errores `CLIENT_*` a campos y los mensajes de `registrationOutcome` (éxito, fallo de correo, persona existente)
- [x] 6.3 Agregar una prueba que verifique que el payload construido para el registro incluye `roles: ['client']` y el campo `address`

## 7. Verificación

- [x] 7.1 Ejecutar `npm run lint` en `vet-manage-frontend` y corregir advertencias/errores
- [x] 7.2 Ejecutar `npm run test` en `vet-manage-frontend` y confirmar que todas las pruebas pasan
- [x] 7.3 Ejecutar `npm run build` en `vet-manage-frontend` y confirmar compilación sin errores
- [x] 7.4 Verificar en `http://localhost:5174/clients` el botón "Nuevo cliente", la navegación a `/clients/new`, el rol `client` preseleccionado, el guardado exitoso y el manejo de errores

## 8. Correcciones de backend necesarias para el guardado

- [x] 8.1 Cambiar `import type { ClientRegistrationDto }` por import de valor en `clients.controller.ts` para que la `ValidationPipe` reconozca el DTO
- [x] 8.2 Crear la migración `20261119150000_add_person_address` que agrega `persons.address` (declarada en el schema pero sin migración)
- [x] 8.3 Aplicar la migración y verificar de extremo a extremo que `POST /clients` devuelve 201 y `GET /clients` lista el cliente con dirección y rol `client`
- [x] 8.4 Ejecutar `npm test`, `npm run lint` y `npm run build` en `vet-manage-api` sin regresiones
