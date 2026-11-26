## Context

- **Backend**: el módulo existe en `vet-manage-api/src/modules/pets/` con `routes/patients.controller.ts`, `dtos/patients/register-patient.dto.ts`, `services/patients/register-patient.service.ts`, `repositories/patient.repository.ts` y `pets.module.ts`. Hoy solo expone `POST /api/v1/pets` (`pets:create`); **no existe `GET /api/v1/pets`** ni DTO, servicio o repositorio de consulta. `PatientRepository` solo tiene `create`.
- **Modelo**: `Patient` en `prisma/schema/pets.prisma`, mapeado a la tabla `patients`, con `code PAC-NNNNNN` generado por `patient_code_seq`, `name`, `gender`, `birthDate @db.Date`, `weightKg`/`heightCm` `Decimal(6,2)`, `reproductiveStatus`, `color?`, `status: RecordStatus`, relaciones con `client`, `species` y `breed`, índices en `clientId` y `status`. La migración de renombrado `pets → patients` ya está aplicada.
- **Patrón HU-06**: `GET /api/v1/clients` usa `ListClientsQueryDto` (`page=1`, `pageSize=20`, máximo 100), `ClientsRepository.findClients` y `ClientsService.list`, que devuelve `{ items, page, pageSize, total, totalPages }` con `totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)`.
- **Normalización existente**: `clients.repository.ts` ya resuelve acentos con `ACCENT_EQUIVALENTS` para `a/e/i/o/u/n`, descomposición `NFD`, eliminación de marcas combinantes, `mode: 'insensitive'` y un límite de 64 variantes (`MAX_SEARCH_VARIANTS`). Se reutiliza esa estrategia en vez de crear otra.
- **RBAC**: `pets:read` está declarado en `config/permissions/clinical.permissions.ts`. El catálogo lo asigna a `superadmin`, `manager`, `veterinarian`, `veterinary_technician` y `receptionist`, coherente con la matriz del Módulo 1 para los cuatro roles clínicos. `@RequirePermissions` aplica `JwtAuthGuard` + `PermissionsGuard` y devuelve «No tiene permisos para realizar esta acción».
- **Frontend**: `/pets` apunta a `modules/pets/pages/patients-page.tsx`, ya protegida por `<RequirePermission permission="pets:read">` en `router.tsx`. El placeholder está en las líneas 85-89 como un `<strong>` y un `<span>` dentro de `.patients-placeholder`. El servicio de pacientes es `services/patient.service.ts` (`patientApi.registerPatient`), y el tipo `RegisteredPatient` ya incluye `species`, `breed` y `birthDate` en `DD-MM-YYYY`.
- **UI existente**: no hay componentes React exportados para tabla, badge, empty state ni modal en `common/components`. Esos elementos son clases CSS en `styles/index.css` (`.product-table`, `.status-badge`, `.empty-state`, `.modal-overlay`, `.modal-card`, `.search-field`, `.button`, entre otras) y las páginas las usan con marcado inline.
- **Entorno**: Docker Compose publica API en `http://localhost:3080/api/v1`, frontend en `http://localhost:5174`, PostgreSQL en `55432`, Redis en `56379`, RabbitMQ en `55672` y su administración en `15673`. Los contenedores usan nombres de servicio y `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`. Arranque con `make up`; pruebas con `npm test` y `npm run test:e2e` en `vet-manage-api/` y `npm test` en `vet-manage-frontend/`.

## Goals / Non-Goals

**Goals:**

- Exponer `GET /api/v1/pets` con búsqueda y paginación de 20, ampliando el módulo `pets` existente.
- Buscar por nombre del paciente, código `PAC-` con 4 a 6 dígitos (`PAC-0001` y `PAC-000001`), primer nombre del cliente y prefijo de cédula, ignorando mayúsculas, tildes y espacios.
- Devolver código, nombre, especie, raza, cliente, estado y datos clínicos básicos en cada resultado.
- Sustituir el placeholder de `/pets` por buscador, tabla, paginación y ficha de solo lectura, reutilizando las clases y el marcado ya presentes.
- Mantener `pets:read` como único control de acceso, apoyándose en el guard que ya protege la ruta.

**Non-Goals:**

- Crear modelos, columnas, migraciones ni seeds nuevos.
- Editar, activar, inactivar ni dar de baja pacientes (HU-08 a HU-11).
- Crear `GET /pets/:id` ni la ruta `/pets/:id`: la ficha se abre con los datos devueltos por la búsqueda.
- Modificar el catálogo RBAC, el registro de pacientes ni la búsqueda de clientes de HU-06.
- Instalar una librería de componentes UI o crear componentes React genéricos nuevos.

## Decisions

### 1. Un único parámetro `search` con coincidencias combinadas

- **Decisión**: `GET /api/v1/pets?search=&page=&pageSize=` interpreta el criterio según su forma:
  1. `/^PAC-\d{4,6}$/i` tras `trim` → igualdad exacta sobre `code`. Se aceptan 4 dígitos porque la HU usa `PAC-0001` como ejemplo y 6 porque es el formato generado por `patient_code_seq`.
  2. `/^\d{5,10}$/` → `client.person.identification` empieza con los dígitos.
  3. Texto de 2 o más caracteres → coincidencia parcial en `patient.name`.
  4. Texto de 3 o más caracteres → coincidencia parcial en `client.person.firstName`.
  Las reglas 3 y 4 se combinan con `OR` en el `where`; una sola fila por paciente evita duplicados.
- **Justificación**: la HU describe un solo buscador sin selector de criterio. Añadir un desplegable para elegir entre «nombre del paciente» y «nombre del cliente» introduciría un control no pedido y dejaría ambiguo un texto como «Ana».
- **Alternativa descartada**: parámetro `searchBy`. Más predecible en pruebas, pero cambia la interacción descrita y duplica validación en el frontend.
- **Validación**: sin `search` → listado completo; 1 carácter que no sea código ni cédula → HTTP 400 con «Ingrese al menos 2 caracteres para buscar por nombre o el código del paciente».

### 2. Normalización acento-insensible reutilizable

- **Decisión**: crear `normalizeSearch(value)` como función pura en `services/patients/` para `trim`, minúsculas, `NFD`, eliminación de marcas combinantes y `ñ → n`, y usar la misma tabla `ACCENT_EQUIVALENTS` de `clients.repository.ts` para generar las variantes del término. La comparación en Prisma usa `mode: 'insensitive'` con `contains`/`startsWith` y respeta el tope `MAX_SEARCH_VARIANTS = 64`.
- **Justificación**: dos implementaciones distintas de «sin tildes» darían resultados diferentes entre clientes y pacientes. Reutilizar la estrategia probada en HU-06 evita además instalar la extensión `unaccent` de PostgreSQL.
- **Alternativa descartada**: `unaccent()` o `translate()` en SQL. Obligaría a crear una función o expresión nueva en la base y a replicar el manejo de `ñ` por separado.

### 3. Repositorio y mapeo de respuesta

- **Decisión**: ampliar `PatientRepository` con `searchPatients({ search, page, pageSize })`:
  - `where` con `OR` según la decisión 1.
  - `select` de `id`, `code`, `name`, `gender`, `birthDate`, `weightKg`, `heightCm`, `reproductiveStatus`, `color`, `status`, `createdAt`, `client.person` (nombre, apellido, cédula), `species { id, name }` y `breed { id, name }`.
  - `orderBy: [{ name: 'asc' }, { code: 'asc' }]`, `skip = (page - 1) * pageSize`, `take = pageSize` y `count` con el mismo `where`, en paralelo como en `ClientsRepository`.
  - `totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)`.
- El servicio mapea `birthDate` con `formatBirthDate` de `birth-date.ts` a `DD-MM-YYYY` y deja `weightKg`/`heightCm` como números con dos decimales, igual que `RegisteredPatient`.
- **Justificación**: el modelo `Patient` ya tiene `speciesId`, así que la especie se obtiene de la relación directa y no «a través de la raza» como describe el diagrama lógico. El `select` evita exponer datos del cliente fuera de la búsqueda y mantiene el límite de capas.
- **Alternativa descartada**: devolver la entidad completa. Acoplaría HTTP con Prisma y filtraría información sensible desde el controlador.

### 4. DTO, servicio y ruta

- **Decisión**: crear `SearchPatientsQueryDto` en `dtos/patients/search-patients-query.dto.ts` con `@IsOptional`/`@Transform` para `search`, `page` y `pageSize`, reutilizando los mensajes de `ListClientsQueryDto`; crear `SearchPatientsService` en `services/patients/search-patients.service.ts` con una prueba unitaria por escenario; registrar `GET /pets` en `routes/patients.controller.ts` con `@RequirePermissions('pets:read')`, antes de las rutas con segmentos fijos como `/pets/species/active`. Declarar repositorio y servicio en `pets.module.ts`.
- **Justificación**: el proyecto usa un servicio por operación y el controlador solo conoce HTTP y DTOs, igual que `POST /pets` en `patients.controller.ts`.
- **Errores**: paginación inválida responde 400 con el envelope estándar; 401 y 403 los resuelven los guards globales, sin lógica nueva.

### 5. Frontend

- **Decisión**: en `modules/pets/pages/patients-page.tsx` se eliminan los dos nodos de `.patients-placeholder` y se colocan el buscador y la tabla; se añaden `modules/pets/hooks/use-patient-query.ts`, `patientApi.searchPatients(params)` en `services/patient.service.ts` y los tipos `PatientSearchItem`/`PatientSearchResponse` en `types.ts`.
- Se reutilizan el marcado y las clases ya usados en `clients-page.tsx`: `.search-field`, `.button`, `.product-table`, `.status-badge`, `.empty-state`, `.modal-overlay` y `.modal-card`. No se crean componentes React compartidos nuevos.
- La búsqueda solo dispara la petición si el término normalizado no está vacío; «Buscar» fija `page=1`, «Limpiar búsqueda» restablece término y página, y la paginación conserva el término con botones «Anterior» / «Página {page} de {totalPages}» / «Siguiente».
- La negación de acceso ya la resuelve `<RequirePermission permission="pets:read">` en `router.tsx`; la página no necesita duplicar ese mensaje.
- **Ficha**: al seleccionar una fila se abre un modal inline con las clases existentes, en modo solo lectura, mostrando los campos del item. No hay navegación ni controles de edición.
- **Justificación**: cumple «permitir seleccionar un paciente para consultar su ficha» sin ampliar el contrato de la API ni inventar una pantalla o librería nueva.
- **Alternativa descartada**: ruta `/pets/:id` con `GET /pets/:id`. Requiere otro endpoint, otro guard y otra página; puede hacerse en una HU posterior si se necesita la historia clínica completa.

### 6. Pruebas

- Unitarias de `normalizeSearch`, `SearchPatientsService` (combinación de criterios, código, cédula, sin resultados) y `PatientRepository.searchPatients` si el `where` se prueba por aislamiento.
- e2e en `test/pets/patients.e2e-spec.ts` con los 8 escenarios de la HU más 401, 403, paginación inválida y segunda página.
- Frontend en `patients-page.test.tsx`, `services/patient.service.test.ts` y una prueba nueva para el hook, verificando placeholder ausente, búsqueda, paginación, mensaje de sin resultados y ficha de solo lectura.

## Risks / Trade-offs

- **[Coincidencias amplias]** → `ana` puede devolver pacientes por nombre de mascota y por nombre de cliente. Es el comportamiento del buscador único; se documenta el orden y se deduplica en el repositorio.
- **[Variantes de acentos]** → El tope de 64 variantes de HU-06 puede descartar términos muy largos. Se mitiga reutilizando el mismo límite y mensaje; cualquier cambio se haría primero en el repositorio de clientes para no divergir.
- **[Rendimiento del `OR`]** → `ILIKE` sobre nombre y nombre de cliente puede no usar índices. Se mitiga con los índices existentes de `code` y `clientId` y con `pageSize <= 100`; una columna normalizada se evaluaría en otra HU.
- **[Permiso en bases inicializadas]** → `pets:read` ya existe en el catálogo; basta comprobar los roles tras `make up`, sin cambiar el modo de sincronización RBAC.
- **[La ficha usa datos de la lista]** → Muestra datos clínicos básicos, no la historia clínica completa. Queda explícito en la spec UI; la ruta dedicada se deja fuera de alcance.
- **[Cambios concurrentes en `/pets`]** → Otras HU pueden tocar `patients-page.tsx`. Se trabaja en `feature/modulo1/HU-12-consultar-paciente` desde `development` y se resuelven conflictos antes del PR.

## Migration Plan

1. Sin cambios de esquema: no ejecutar `prisma migrate dev` ni tocar `prisma/migrations`.
2. Desarrollar en `feature/modulo1/HU-12-consultar-paciente`, ya creada desde `development`, con un PR por HU.
3. `make up` deja la API en `http://localhost:3080/api/v1` y el frontend en `http://localhost:5174`. No hay variables de entorno nuevas: se usan `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `API_PORT` y `VITE_API_URL` ya definidas.
4. Verificar `GET /api/v1/health`, ejecutar `npm test` y `npm run test:e2e` en la API y `npm test` en el frontend, y comprobar el build.
5. Rollback: revertir los commits de la HU; al no haber migración ni datos nuevos, la base no requiere restauración.

## Open Questions

- Ninguna bloqueante. Se asume que «consultar su ficha» se resuelve con el modal de solo lectura alimentado por la respuesta de la búsqueda; una ficha completa con ruta y endpoint propios se trataría como HU separada.
