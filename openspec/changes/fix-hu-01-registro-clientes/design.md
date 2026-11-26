## Context

La funcionalidad de registro de clientes (HU-01) está implementada en el módulo `identity` del backend y en la página `clients/new` del frontend. Las pruebas QA documentadas en `docs/modulo-1-historial-clinico/Defectos-HU-01.md` muestran cuatro desvíos: duplicados por cédula, teléfono opcional, formato de teléfono permisivo y mensajes fuera del contrato.

La documentación funcional impone restricciones que la corrección debe preservar:

- `Persona` es única por cédula y se registra una sola vez aunque sea Cliente y empleado (`diagramas/clases.md:375, 428, 447`; HU-51 Esc. 3).
- `Cliente` es un rol sobre `Persona` y es dueño de cero o más `Paciente`; dar de baja un Cliente no elimina sus mascotas (`clases.md:431`).
- Registrar un paciente exige un Cliente existente y disponible (HU-07), y HU-12 busca por cédula del Cliente asociado.
- Backend monolítico modular con dependencia `routes → services → repositories`, DTOs estrictos, transacciones Prisma y auditoría (`architecture-vet-manage-2026-10-23.md`, `backend-structure.md`).

Entorno local: API `http://localhost:3080/api/v1`, frontend `http://localhost:5174`, PostgreSQL `55432`, Redis `56379`, RabbitMQ AMQP `55672` y management `15673`. La configuración vive en `.env`/`.env.example`; los servicios se conectan por nombre de servicio dentro de Docker. Comandos: `make up`, `make down`, `make logs`, `make test`, `make lint`, `make build`; en API `npm test` y `npm run test:e2e`, en frontend `npm test`.

## Goals / Non-Goals

**Goals:**

- Rechazar con `409` solo la cédula que ya pertenece a un `Client`, con el mensaje exacto de HU-01.
- Permitir que un `STAFF` sin `Client` se registre como cliente reutilizando su Persona y su cuenta, sin cambiar su contraseña.
- Hacer obligatorio el teléfono y exigir exactamente 10 dígitos con prefijo `09` en API y frontend.
- Usar los mensajes literales de HU-01 en respuesta, errores y UI.
- Crear cobertura e2e de `POST /api/v1/clients`, hoy inexistente.

**Non-Goals:**

- Migraciones o cambios en `prisma/schema`.
- Cambios en RBAC, catálogo de roles o permisos.
- Cambios en el registro de usuarios ni en su regex de teléfono de 7–15 dígitos.
- Cambios en HU-06, HU-07 o HU-12, salvo la verificación de que siguen funcionando.
- Edición de los documentos QA sin trackear ni de los archivos borrados de `HUs/`.
- Creación de nuevos módulos de negocio o capa `use-cases`.

## Decisions

1. **Unicidad condicionada a la existencia de `Client`, no a la categoría de rol.**
   `persist()` buscará la Persona por cédula y comprobará si ya tiene registro `Client`. Si lo tiene, lanza `409 CLIENT_IDENTIFICATION_TAKEN`. Si no lo tiene, continúa con reutilización.
   *Alternativas descartadas:* rechazar toda Persona existente (rompe Party–Role e impide que personal se vuelva cliente); mantener el rechazo por rol `STAFF` (deja el caso `1104913395` como falso duplicado).

2. **Reutilización sin sobrescritura de identidad.**
   Al reutilizar Persona se conservan `firstName`, `lastName`, `email` y `phone`. El correo es la llave de acceso, así que cambiarlo sería una modificación de cuenta. El teléfono y el correo enviados se validan, pero no se aplican sobre los datos del empleado. `address` se escribe solo si la Persona no tiene dirección.
   *Alternativa descartada:* actualizar todos los campos de la Persona, con riesgo de alterar datos del personal y su login.

3. **Sin regeneración de contraseña ni correo de credenciales.**
   Para una cuenta existente se mantiene `passwordAssigned = false` y `credentialsSent = false`. El mensaje de éxito sigue siendo el contractual.
   *Alternativa descartada:* generar contraseña temporal y enviarla, que alteraría el acceso del empleado.

4. **Regex de teléfono específico de clientes.**
   `/^09\d{8}$/` en `client-registration.service.ts` y `clients/form-rules.ts`. No se extrae a una utilidad compartida con registro de usuarios porque su spec define 7–15 dígitos y cambiarla quedaría fuera de alcance.

5. **Mensajes centralizados donde ya están.**
   Se ajustan `CLIENT_MESSAGES` (API) y las constantes de `form-rules.ts` (frontend) sin crear un paquete compartido ni un módulo nuevo. `describeApiError()` mantendrá códigos distintos para correo y teléfono, pero con el mismo texto contractual.

6. **Transacción y auditoría existentes.**
   Se conserva `$transaction`, `assignRoles()`, `client.upsert()` y `audit.record()`. Solo cambia la rama de decisión sobre la Persona encontrada; las asociaciones Cliente → Paciente no se tocan.

7. **Nueva suite e2e en `vet-manage-api/test/clients/client-registration.e2e-spec.ts`.**
   Cubre el contrato final, incluido el caso real de `STAFF` sin `Client` y la regresión de un Cliente con pacientes.
   *Alternativa descartada:* ampliar solo tests unitarios, que no cubren RBAC ni la respuesta HTTP.

## Risks / Trade-offs

- **[Riesgo] El usuario envía correo o teléfono distintos a los de la Persona reutilizada y no ve reflejados los nuevos valores.** → Mitigación: se validan los datos, se conserva la identidad existente por diseño y se elimina el texto adicional de `registrationOutcome()` para no sugerir una sobrescritura.
- **[Riesgo] `address` vive en `Person` y es compartido con el rol de empleado.** → Mitigación: solo se graba si está vacío; no se sobrescribe una dirección existente.
- **[Riesgo] Un Cliente dado de baja vuelve a registrarse y se crea un segundo `Client`.** → Mitigación: la comprobación de `Client` existente aplica a cualquier `RecordStatus`; la reactivación corresponde a HU-05, no a un nuevo registro.
- **[Riesgo] Cambio de comportamiento para `STAFF`.** → Mitigación: está explicitado como **BREAKING** en el proposal y cubierto por escenario e2e con `1104913395`.
- **[Riesgo] El e2e completo ya tiene un fallo preexistente ajeno en `rbac-catalog.e2e-spec.ts`.** → Mitigación: no modificar RBAC; reportar ese fallo como conocido y verificar la nueva suite de forma focalizada.
- **[Trade-off] No unificar la validación telefónica con usuarios.** → Evita romper HU-51; deja dos regex con reglas distintas hasta que se decida un cambio separado.

## Migration Plan

No hay migración de base de datos ni datos a transformar: `identification @unique`, `RoleCategory` y `Person.address` ya existen.

1. Verificar rama limpia desde `development`; no mezclar borrados de `HUs/` ni documentos QA sin trackear.
2. Implementar cambios de API, frontend y pruebas según `tasks.md`.
3. Ejecutar en API `npm test` y `npm run test:e2e` (foco en la nueva suite clientes), en frontend `npm test`, y `make build` / `make lint`.
4. Verificación HTTP local con `GET /api/v1/health` y `POST /api/v1/clients` usando un usuario con `clients:create`.
5. Despliegue: merge a `development` tras aprobación; rollback consiste en revertir el commit, sin restaurar datos.

## Open Questions

Ninguna pendiente. Las decisiones sobre `STAFF → Cliente`, conservación de datos y política de dirección quedaron cerradas en `Decisions`. La unificación futura de la regex de teléfono con registro de usuarios queda fuera de este change.
