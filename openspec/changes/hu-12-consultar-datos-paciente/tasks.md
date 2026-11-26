## 1. Preparación y verificación del contexto

- [x] 1.1 Confirmar que el working tree está en `feature/modulo1/HU-12-consultar-paciente` y sincronizado con `origin/development`
- [x] 1.2 Releer `docs/modulo-1-historial-clinico/historias-usuario/12-consultar-datos-paciente.md`, `diagramas/clases.md` y `matriz-roles-permisos.md` como fuente de los 8 escenarios y de los roles autorizados
- [x] 1.3 Verificar en `config/permissions/clinical.permissions.ts` y `config/roles.catalog.ts` que `pets:read` ya existe y está asignado a `superadmin`, `manager`, `veterinarian`, `veterinary_technician` y `receptionist`; no modificar el catálogo
- [x] 1.4 Confirmar que `GET /api/v1/pets` no existe y que `patients-page.tsx` sigue mostrando `.patients-placeholder`; inventariar las clases CSS reutilizables de `styles/index.css` (`.search-field`, `.button`, `.product-table`, `.status-badge`, `.empty-state`, `.modal-overlay`, `.modal-card`) y el marcado inline de `clients-page.tsx`

## 2. Backend: normalización y contrato de consulta

- [x] 2.1 Crear `normalizeSearch` como función pura en `vet-manage-api/src/modules/pets/services/patients/normalize-search.ts` (`trim`, minúsculas, `NFD`, sin marcas combinantes, `ñ → n`) con pruebas para `José`/`JOSE`/` josé ` y `nino`/`Niño`
- [x] 2.2 Reutilizar `ACCENT_EQUIVALENTS` y `MAX_SEARCH_VARIANTS = 64` de `modules/clients/repositories/clients.repository.ts` para construir las variantes del término con `mode: 'insensitive'`; no instalar `unaccent` ni duplicar la estrategia
- [x] 2.3 Crear `SearchPatientsQueryDto` en `vet-manage-api/src/modules/pets/dtos/patients/search-patients-query.dto.ts` con `search` opcional, `page = 1`, `pageSize = 20`, máximo 100 y los mismos mensajes de `ListClientsQueryDto`
- [x] 2.4 Definir el tipo de respuesta `PatientSearchItem` con `id`, `code`, `name`, `species`, `breed`, `client` (nombre, apellido, cédula), `status`, `gender`, `birthDate` en `DD-MM-YYYY`, `weightKg`, `heightCm`, `reproductiveStatus` y `color`

## 3. Backend: repositorio y servicio

- [x] 3.1 Agregar `PatientRepository.searchPatients({ search, page, pageSize })` en `repositories/patient.repository.ts` con `findMany` y `count` en paralelo bajo el mismo `where`
- [x] 3.2 Construir el `OR` del `where`: `code` en mayúsculas para `PAC-` con 4 a 6 dígitos, `client.person.identification.startsWith` para 5-10 dígitos, variantes de `name` para texto de 2+ caracteres y variantes de `client.person.firstName` para texto de 3+ caracteres
- [x] 3.3 Hacer el `select` de `id`, `code`, `name`, `gender`, `birthDate`, `weightKg`, `heightCm`, `reproductiveStatus`, `color`, `status`, `createdAt`, `client.person`, `species { id, name }` y `breed { id, name }`, con `orderBy: [{ name: 'asc' }, { code: 'asc' }]`, `skip`, `take` y `totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)`
- [x] 3.4 Formatear `birthDate` con `formatBirthDate` de `services/patients/birth-date.ts` y dejar `weightKg`/`heightCm` como números con dos decimales, igual que `RegisteredPatient`
- [x] 3.5 Crear `SearchPatientsService` en `vet-manage-api/src/modules/pets/services/patients/search-patients.service.ts`; sin `search` devuelve el listado completo y con 1 carácter que no sea código ni cédula responde 400 con «Ingrese al menos 2 caracteres para buscar por nombre o el código del paciente»
- [x] 3.6 Escribir pruebas unitarias de `SearchPatientsService` para nombre parcial, código exacto, nombre del cliente, cédula del cliente, sin coincidencias, combinación de criterios, criterio vacío y estados `ACTIVE`/`INACTIVE`/`DEACTIVATED`

## 4. Backend: ruta y pruebas e2e

- [x] 4.1 Registrar `GET /pets` en `vet-manage-api/src/modules/pets/routes/patients.controller.ts` con `@RequirePermissions('pets:read')`, antes de `/pets/species/active` y `/pets/species/:speciesId/breeds`; declarar servicio y repositorio en `pets.module.ts`
- [x] 4.2 Verificar que `POST /pets` de HU-07 y las rutas de especies y razas siguen respondiendo igual tras agregar `GET /pets`
- [x] 4.3 Agregar en `vet-manage-api/test/pets/patients.e2e-spec.ts` los 8 escenarios de la HU: nombre del paciente, código `PAC-0001` (4 dígitos) y `PAC-000001` (6 dígitos), primer nombre del cliente, cédula del cliente, acentos/espacios, sin resultados, criterio vacío y visibilidad de los tres estados
- [x] 4.4 Agregar pruebas e2e de 401 sin token, 403 sin `pets:read`, `page=0`, `pageSize=101`, segunda página y `totalPages` con cero resultados

## 5. Frontend: tipos, servicio y hook

- [x] 5.1 Agregar `PatientSearchItem` y `PatientSearchResponse` en `vet-manage-frontend/src/modules/pets/types.ts`, alineados con el envelope y con `PatientSearchItem` del backend
- [x] 5.2 Agregar `searchPatients(params)` a `patientApi` en `vet-manage-frontend/src/modules/pets/services/patient.service.ts`, construyendo la query con `URLSearchParams` como `clientsApi.list` y usando el wrapper `getJson` de `requestJson`
- [x] 5.3 Crear `vet-manage-frontend/src/modules/pets/hooks/use-patient-query.ts` con término, página, resultados, total, `loading`, `error` y `validationError`; sin petición con término vacío y reinicio a página 1 al buscar o limpiar

## 6. Frontend: página de `/pets` y ficha

- [x] 6.1 Eliminar los dos nodos de `.patients-placeholder` en `vet-manage-frontend/src/modules/pets/pages/patients-page.tsx` y colocar el buscador con `.search-field` y el botón «Buscar» con `.button`, conservando «Nuevo paciente» de HU-07
- [x] 6.2 Renderizar la tabla con `.product-table` y columnas Código, Nombre, Especie, Cliente y Estado usando `.status-badge`, y la paginación «Anterior» / «Página {page} de {totalPages}» / «Siguiente»
- [x] 6.3 Mostrar «No se encontraron pacientes que coincidan con la búsqueda» con `.empty-state` cuando `items` esté vacío, sin renderizar filas; verificar que `<RequirePermission permission="pets:read">` en `router.tsx` ya bloquea la vista sin duplicar el mensaje
- [x] 6.4 Implementar «Buscar», «Limpiar búsqueda» y el cambio de página conservando el término, sin ejecutar consulta con criterio vacío
- [x] 6.5 Abrir al seleccionar una fila un modal inline con `.modal-overlay` y `.modal-card`, en modo solo lectura con los datos del item y sin controles de edición, activación, inactivación ni baja; conservar tabla y búsqueda al cerrarlo
- [x] 6.6 Actualizar `patients-page.test.tsx`, `services/patient.service.test.ts` y agregar una prueba del hook para placeholder ausente, los cuatro criterios, paginación, mensaje de sin resultados, ficha de solo lectura y ocultamiento sin permiso

## 7. Verificación final

- [ ] 7.1 Ejecutar `npm test` y `npm run test:e2e` en `vet-manage-api/` y `npm test` en `vet-manage-frontend/`
- [x] 7.2 Ejecutar el build de ambos proyectos y comprobar que `npx tsc --noEmit` no introduce errores nuevos
- [ ] 7.3 Con `make up`, verificar `http://localhost:3080/api/v1/health` y probar en `http://localhost:5174/pets` los 8 escenarios con un usuario Recepcionista y otro Técnico Veterinario
- [ ] 7.4 Confirmar que no se crearon migraciones, que no se modificó el catálogo RBAC y que el PR apunta a `development` desde `feature/modulo1/HU-12-consultar-paciente`

## Estado de verificación

- **7.1**: unitarias API 379/379 y frontend 156/156 OK; e2e de pacientes 44/44 OK. La suite e2e completa queda en 178/179 por un fallo preexistente y ajeno a HU-12 en `test/identity/rbac-catalog.e2e-spec.ts`: espera 8 roles, pero el catálogo base define 9. No se modifica RBAC sin autorización.
- **7.2**: `npm run build` y `npm run lint` OK en API y frontend. `npx tsc --noEmit -p tsconfig.app.json` sin errores. El `tsc --noEmit` de la API conserva errores preexistentes en specs ajenos a HU-12; ninguno apunta a archivos de este cambio.
- **7.3**: health 200, `GET /pets` sin token 401, con `pets:read` 200, validación de término corto y paginación 400, frontend `/pets` 200. Queda pendiente la prueba manual en navegador con credenciales de Recepcionista y Técnico Veterinario.
- **7.4**: no hay cambios en migraciones ni en el catálogo RBAC. Consulta de solo lectura a GitHub: PR #23 está cerrado y apunta a `development` (head `feature/modulo1/HU-01-regisrar-cliente`); no existe PR para HU-12. No se creó PR ni commit y no se realizó ninguna acción sobre PRs.
