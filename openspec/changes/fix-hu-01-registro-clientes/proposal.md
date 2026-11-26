## Why

Los casos de prueba y la matriz de defectos de HU-01 (`docs/modulo-1-historial-clinico/Casos-pruebaHU-01.md` y `Defectos-HU-01.md`) muestran cuatro desvíos respecto de los criterios de aceptación: se acepta una cédula ya registrada, el teléfono es opcional, se aceptan formatos de teléfono inválidos y los mensajes no coinciden con la HU. La corrección debe respetar el modelo Party–Role documentado: una Persona se registra una sola vez aunque sea Cliente y empleado, y el Cliente es el dueño de los Pacientes.

## What Changes

- **BREAKING** Rechazar con `409` y «Número de cédula ya registrado» solo cuando la cédula ya pertenece a un `Client`. Un `STAFF` sin `Client` deja de recibir `409`: se registra como cliente reutilizando su Persona, agregando el rol `client` a su cuenta y creando el `Client`, sin cambiar su contraseña ni sobrescribir sus datos.
- Hacer obligatorio el teléfono en API y frontend, con formato exacto de 10 dígitos y prefijo `09` (`^09\d{8}$`).
- Alinear los mensajes de éxito y validación a los textos de HU-01: «Cliente registrado exitosamente», «Por favor, complete todos los campos obligatorios», «Número de cédula no válido» y «Por favor, ingrese un correo y número de teléfono válido».
- Mantener «Número de cédula ya registrado» y «Dirección no válida», que ya coinciden.
- Crear cobertura e2e de `POST /api/v1/clients`, de la que hoy carece el repositorio, incluyendo la matriz de roles y la regresión de un cliente con pacientes asociados.
- No modificar migraciones, `prisma/schema`, RBAC, registro de usuarios ni funcionalidad de pacientes.

## Capabilities

### New Capabilities

_Ninguna. Se corrige una capacidad existente._

### Modified Capabilities

- `client-registration`: cambia la regla de unicidad por cédula para distinguir `Client` existente de Persona `STAFF` reutilizable; hace obligatorio el teléfono con formato `^09\d{8}$`; fija los mensajes contractuales de la HU-01.

## Impact

- API: `client-registration.dto.ts`, `client-registration.service.ts`, constantes de mensajes y validación; controlador `POST /clients` sin cambios de ruta.
- Frontend: `clients/form-rules.ts`, `client-register-page.tsx`, `clients/types.ts` y sus pruebas.
- Pruebas: unitarias de API/frontend y nuevo archivo e2e `test/clients/client-registration.e2e-spec.ts`.
- Datos: sin migración; `identification @unique`, `role_category` y `Person.address` ya existen. Se conservan la contraseña del personal y las asociaciones Cliente → Paciente.
- Documentación funcional de origen: `docs/specifications/client-registration-spec.md`, `docs/modulo-1-historial-clinico/diagramas/clases.md`, `matriz-roles-permisos.md` e historias HU-01, HU-07, HU-12 y HU-51.
