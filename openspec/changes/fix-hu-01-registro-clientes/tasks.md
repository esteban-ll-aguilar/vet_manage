## 1. Preparación y alcance

- [x] 1.1 Crear una rama limpia desde `development` y confirmar que no incluye los borrados de `HUs/` ni los documentos QA sin trackear
- [x] 1.2 Confirmar que no se tocarán migraciones, `prisma/schema`, RBAC, registro de usuarios ni funcionalidad de pacientes

## 2. Contrato de API para registro de clientes

- [x] 2.1 Hacer obligatorio `phone` en `client-registration.dto.ts` eliminando `@IsOptional()`
- [x] 2.2 Reemplazar `PHONE_PATTERN` en `client-registration.service.ts` por `/^09\d{8}$/`
- [x] 2.3 Incluir `phone` en la lista de campos obligatorios de `validate()` con el código `CLIENT_MISSING_FIELDS`
- [x] 2.4 Ajustar `CLIENT_MESSAGES` a los textos exactos de HU-01: `registered`, `missing`, `invalidIdentification`, `invalidEmail` e `invalidPhone`
- [x] 2.5 Usar «Por favor, ingrese un correo y número de teléfono válido» tanto para correo inválido como para teléfono inválido, conservando códigos de error distintos para resaltado
- [x] 2.6 Modificar `persist()` para rechazar con 409 solo si la cédula ya tiene un registro `Client`, con cualquier estado de registro
- [x] 2.7 Modificar `persist()` para reutilizar Persona y cuenta cuando existe `STAFF` sin `Client`: agregar rol `client`, crear `Client`, no regenerar contraseña, no enviar credenciales y no sobrescribir nombre, apellido, correo ni teléfono
- [x] 2.8 Escribir `address` sobre la Persona reutilizada solo cuando esté vacía, sin sobrescribir una dirección existente
- [x] 2.9 Conservar la auditoría existente y el manejo de `P2002` como conflicto por carrera de inserción

## 3. Pruebas unitarias de API

- [x] 3.1 Actualizar los tests que hoy esperan teléfono vacío válido para que exijan `CLIENT_MISSING_FIELDS` con `phone` en `errors`
- [x] 3.2 Actualizar los tests que hoy esperan 409 para `STAFF` sin `Client` para que verifiquen reutilización de Persona y cuenta, rol `client` agregado, `passwordAssigned: false` y `credentialsSent: false`
- [x] 3.3 Agregar test de cédula con `Client` existente que verifique 409, mensaje exacto, mismo `client.id` y pacientes intactos
- [x] 3.4 Agregar tests de teléfono con 9 dígitos, 11 dígitos, prefijo inválido y prefijo `09` válido
- [x] 3.5 Actualizar los literales de mensajes en los tests a los textos exactos de HU-01
- [x] 3.6 Verificar en los tests de reutilización que nombre, apellido, correo y teléfono de la Persona no cambian y que `address` se escribe solo si estaba vacía

## 4. Pruebas e2e de `POST /api/v1/clients`

- [x] 4.1 Crear `vet-manage-api/test/clients/client-registration.e2e-spec.ts` con login de Recepcionista y helpers de limpieza
- [x] 4.2 Cubrir registro exitoso con teléfono `0999999999`, dirección opcional vacía y mensaje «Cliente registrado exitosamente»
- [x] 4.3 Cubrir matriz de roles: Recepcionista, Veterinario y Gerente con 201; Cajero, Técnico y Administrador con 403
- [x] 4.4 Cubrir cédula de cliente duplicada con 409 y verificar que no se crea otro `Client` ni se alteran sus pacientes
- [x] 4.5 Cubrir el caso real `1104913395` como `STAFF` sin `Client`: 201, mismo `person_id` y `user_id`, rol `client` agregado, contraseña intacta y sin correo de credenciales
- [x] 4.6 Cubrir obligatorios vacíos, cédula inválida, correo inválido y teléfonos inválidos con sus mensajes exactos
- [x] 4.7 Cubrir dirección de 255 caracteres aceptada y 256 rechazada con «Dirección no válida»

## 5. Frontend

- [x] 5.1 Hacer obligatorio `phone` en `form-rules.ts`, `buildClientInput()` y `clients/types.ts`
- [x] 5.2 Reemplazar la expresión de teléfono del frontend por `/^09\d{8}$/`
- [x] 5.3 Actualizar las constantes de mensajes del frontend a los textos exactos de HU-01 y mapear correo y teléfono al mensaje combinado en `describeApiError()`
- [x] 5.4 Quitar el punto final y el sufijo «La persona ya existía…» de `registrationOutcome()`
- [x] 5.5 Actualizar `client-register-page.tsx`: quitar «Opcional» y marcar el teléfono como obligatorio. No se usa `maxLength`: la validación rechaza 9 u 11 dígitos y muestra el mensaje contractual (un `maxLength={10}` truncaba la entrada y podía guardar un teléfono inválido)
- [x] 5.6 Actualizar `form-rules.test.ts` y agregar pruebas del formulario que verifiquen etiqueta obligatoria, resaltado, rechazo de 11 dígitos y mensaje de éxito exacto

## 6. Verificación y cierre

- [x] 6.1 Ejecutar lint, tests unitarios y build de API
- [x] 6.2 Ejecutar la nueva suite e2e de clientes y luego `npm run test:e2e` completo, reportando como conocido el fallo preexistente de `rbac-catalog.e2e-spec.ts`
- [x] 6.3 Ejecutar lint, tests unitarios y build de frontend
- [x] 6.4 Verificar en local `GET /api/v1/health` y `POST /api/v1/clients` con un usuario con `clients:create`, incluyendo el caso `1104913395`
- [x] 6.5 Ejecutar `openspec validate fix-hu-01-registro-clientes --strict` y `git diff --check`, y confirmar que no se incluyeron migraciones, RBAC ni archivos fuera de alcance
