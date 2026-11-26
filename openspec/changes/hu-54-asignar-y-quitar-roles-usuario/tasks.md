## 1. Backend — consulta y actualización de roles

- [x] 1.1 Crear en `vet-manage-api/src/modules/identity` el DTO y los tipos de respuesta para `GET/PUT /users/:id/role-assignment`, normalizando `roles` (trim, únicos, no vacíos) y validando el formato de entrada.
- [x] 1.2 Implementar el servicio/repositorio de asignación para devolver usuario, roles efectivos vigentes y roles `STAFF` activos disponibles, excluyendo los ya asignados y respondiendo 404 con envelope estándar si el usuario no existe.
- [x] 1.3 Implementar la actualización atómica en transacción Prisma: calcular diff, crear o reactivar asignaciones (`expiresAt = null`, `assignedById`), eliminar roles quitados, rechazar resultado sin roles, usuario `DEACTIVATED`, roles no asignables y la remoción del último Administrador activo con los mensajes de HU-54.
- [x] 1.4 Exponer `GET` y `PUT /api/v1/users/:id/role-assignment` en el controlador de identidad protegidos con `@RequirePermissions('users:assign-roles')`, devolver `success(...)` y registrar los providers necesarios en `identity.module.ts`.

## 2. Backend — pruebas

- [x] 2.1 Agregar pruebas unitarias del servicio de asignación que verifiquen: asignar rol adicional, quitar un rol, cambiar función, rechazar guardar sin roles, rechazar quitar el último Administrador activo y rechazar usuario dado de baja sin cambios.
- [x] 2.2 Agregar `vet-manage-api/test/identity/user-role-assignment.e2e-spec.ts` que cubra consulta de roles actuales/disponibles, los escenarios de HU-54, 401 sin sesión, 403 sin `users:assign-roles`, 404 y el efecto de los cambios en roles/permisos efectivos.
- [x] 2.3 Ejecutar las pruebas unitarias y e2e relacionadas con identity en `vet-manage-api` y confirmar que los casos nuevos y existentes relevantes pasan.

## 3. Frontend — tipos, servicio e interfaz

- [x] 3.1 Extender `vet-manage-frontend/src/modules/users/types.ts` y `services/users-api.ts` con los contratos y métodos para consultar y guardar la asignación de roles (`/users/:id/role-assignment`).
- [x] 3.2 Implementar la gestión de roles accesible desde `/users` (ruta o vista protegida por `users:assign-roles`) que cargue usuario, roles actuales y roles disponibles, permita ajustar la selección y guardar los cambios.
- [x] 3.3 Aplicar en la UI los comportamientos de HU-54: no ofrecer roles ya asignados, impedir guardar sin roles con "El usuario debe tener al menos un rol", mostrar los mensajes de rechazo del backend, confirmar la actualización y refrescar el estado mostrado.
- [x] 3.4 Garantizar que usuarios sin `users:assign-roles` vean "No tiene permisos para realizar esta acción" al intentar acceder a la gestión de roles y que no se rendericen sus controles.

## 4. Frontend — pruebas

- [x] 4.1 Agregar pruebas unitarias del servicio/API de usuarios para verificar las solicitudes de consulta y guardado de la asignación de roles.
- [x] 4.2 Agregar pruebas de interfaz con Testing Library/Vitest que cubran asignar, quitar y cambiar roles, exclusión de roles ya asignados, bloqueo al guardar sin roles, visualización de errores de negocio y denegación de acceso sin permiso.

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm run build`, `npm test` y `npm run lint` en `vet-manage-api` y en `vet-manage-frontend`, corrigiendo los fallos introducidos por HU-54.
- [x] 5.2 Ejecutar `make test`, `make lint` y `make build` desde la raíz del repositorio y confirmar que finalizan correctamente.
- [x] 5.3 Verificar manualmente los 8 escenarios de HU-54 en la aplicación levantada (`docker compose up --build -d`, frontend `http://localhost:5174`, API `http://localhost:3080/api/v1`) y registrar la implementación y evidencia en `.work-log.md`.
