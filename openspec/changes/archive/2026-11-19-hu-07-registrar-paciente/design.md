## Context

- **Clientes (HU-01, rama sin aceptar)**: existe el modelo `Client { id, personId, status: RecordStatus }`, con nombre y cédula en `Person`. `GET /api/v1/clients?status=&search=&page=&pageSize=` está protegido con `clients:read`. `ClientsModule` no exporta `ClientsService` y no hay forma de buscar un cliente por id.
- **Especies y razas (HU-13, HU-17, en `development`)**: modelos `Species` y `Breed` en `pets.prisma`, con `SpeciesRepository.findById`, `BreedRepository` y `GET /pets/species/active`. No hay endpoint para listar razas.
- **Permisos (`roles.catalog.ts`)**: Recepcionista y Gerente tienen `pets:create`, `clients:read`, `species:read` y `breeds:read`. El Veterinario tiene `clients:read`, `species:read` y `breeds:read`, pero se le quitó `pets:create`, y `catalogs.spec.ts` lo comprueba. La HU pide que el Veterinario también registre pacientes.
- **Frontend**: la ruta `/pets` muestra `ComingSoonPage`. El módulo `pets` ya tiene `services/`, `schemas/`, `components/` y `pages/` de especies y razas.
- **Errores**: `ApiException(message, status, fields, code)` permite devolver los campos inválidos para resaltarlos en el formulario.

## Goals / Non-Goals

**Goals:**
- Modelo `Pet` con su código identificador, enums y migración.
- `POST /api/v1/pets` con un servicio por operación (`RegisterPetService`).
- `GET /api/v1/pets/species/:speciesId/breeds` con su propio servicio (`ListActiveBreedsService`).
- Validar el cliente a través del dominio `clients`, sin consultar su tabla desde `pets`.
- Página `/pets` con el formulario de registro en un modal.
- Que Recepcionista, Gerente y Veterinario puedan registrar pacientes.

**Non-Goals:**
- Listar, consultar, editar o cambiar el estado de pacientes (HU-08 a HU-12). `/pets` muestra un estado vacío con el botón «Nuevo paciente».
- La ficha del paciente (HU-12). El código se guarda y se devuelve en la respuesta de `POST /pets`, pero el toast de confirmación no lo muestra; la ficha (HU-12) lo mostrará.
- Cambiar otros permisos del Veterinario: sigue sin `pets:inactivate` ni `pets:activate`.

## Decisions

### 1. Modelo `Pet` en `pets.prisma`
- **Decisión**:
  ```
  enum PetSex { MALE FEMALE }
  enum ReproductiveStatus { STERILIZED NOT_STERILIZED UNKNOWN }
  model Pet {
    id                 UUID
    code               VarChar(12) @unique, default de BD con secuencia
    name               VarChar(100)
    sex                PetSex
    birthDate          Date
    weightKg           Decimal(6,2)
    heightCm           Decimal(6,2)
    reproductiveStatus ReproductiveStatus
    color              VarChar(50)?
    status             RecordStatus @default(ACTIVE)
    clientId → Client, speciesId → Species, breedId → Breed  (onDelete: Restrict)
    createdAt, updatedAt
    @@index([clientId]) @@index([status]) → tabla "pets"
  }
  ```
  Se agrega la relación inversa `pets Pet[]` en `Client`, `Species` y `Breed`.
- **Justificación**: se reutiliza `RecordStatus` (`ACTIVE`/`INACTIVE`/`DEACTIVATED`), que HU-09 a HU-11 necesitarán. `Decimal(6,2)` admite hasta 9999.99 kg o cm, sin los errores de redondeo de `Float`. `Restrict` evita borrar clientes, especies o razas que tengan pacientes.
- **Nota**: agregar `pets Pet[]` en `Client` toca `identity.prisma`, que es de HU-01. Es una sola línea, pero hay que avisar.

### 2. Código identificador generado por la base de datos
- **Decisión**: la migración crea la secuencia `pet_code_seq`, y la columna `code` tiene `@default(dbgenerated("'PAC-' || lpad(nextval('pet_code_seq')::text, 6, '0')"))`. Como el `ValidationPipe` global usa `forbidNonWhitelisted` y rechazaría un campo desconocido, el DTO declara `code` como opcional y `RegisterPetService` nunca lo lee.
- **Justificación**: la secuencia es atómica, así que dos registros simultáneos no pueden recibir el mismo código, y no hace falta una segunda escritura. El índice `@unique` es un respaldo adicional.
- **Alternativas descartadas**: calcular `MAX(code)+1` en el servicio (hay condición de carrera); insertar y luego actualizar con un `autoincrement` (dos escrituras y un estado intermedio sin código); usar UUID corto (no es legible para la recepción).

### 3. Validación en el servicio con mensajes de la HU
- **Decisión**: el DTO declara los tipos con `@IsOptional()` para que el `ValidationPipe` no responda antes con mensajes genéricos. `RegisterPetService.validate()` revisa en este orden:
  1. Falta `clientId` → 400 «Debe seleccionar un cliente registrado».
  2. Faltan otros obligatorios → 400 «Por favor, complete todos los campos obligatorios», con la lista de `fields`.
  3. `sex` o `reproductiveStatus` fuera de los enums → 400 con el campo.
  4. Fecha → 400 «Fecha de nacimiento inválida».
  5. Peso o talla → 400 «El peso y la talla deben ser valores numéricos mayores que cero», con el campo.
- **Justificación**: es el mismo patrón que `client-registration.service.ts` de HU-01, y permite devolver exactamente los textos de los criterios de aceptación y los campos a resaltar.
- **Alternativa descartada**: decoradores de class-validator con mensajes. Darían un mensaje por cada decorador y no el mensaje único que pide el escenario 2.

### 4. Fecha `DD-MM-YYYY`
- **Decisión**: la API recibe `birthDate` como texto `DD-MM-YYYY`. Una función pura `parseBirthDate(value, today)` en `pets/services/pets/birth-date.ts` valida la expresión `^\d{2}-\d{2}-\d{4}$`, construye la fecha en UTC, comprueba que día, mes y año no se hayan desbordado (descarta el 31-02) y que no sea posterior a `today`. La respuesta devuelve la fecha en el mismo formato.
- **Zona horaria**: «hoy» se calcula en `America/Guayaquil` (`CLINIC_TIME_ZONE`) con `Intl.DateTimeFormat`, porque el contenedor de la API corre en UTC y entre las 19:00 y las 24:00 de Ecuador ya sería el día siguiente.
- **Justificación**: la HU fija ese formato. Al ser una función pura se puede probar sin la base de datos.

### 5. Validación del cliente a través de `clients`
- **Decisión**: en `modules/clients/` se agregan `ClientsRepository.findById(id)` y `ClientsService.findById(id)`, que devuelven `{ id, status }` o `null`, y `ClientsModule` exporta `ClientsService`. `PetsModule` importa `ClientsModule`. Si `findById` devuelve `null` → 404 «Debe seleccionar un cliente registrado». Si el estado no es `ACTIVE` → 409 «El cliente seleccionado no está disponible».
- **Justificación**: la regla 2 de la estructura del grupo prohíbe consultar tablas de otro dominio. Se rechaza también `INACTIVE`, porque un cliente inactivo no debe recibir pacientes nuevos y el selector ya lo excluye.
- **Riesgo**: es código de la carpeta de HU-01. Hay que avisar al responsable antes de tocarla.

### 6. Especie y raza
- **Decisión**: `RegisterPetService` usa `SpeciesRepository.findById` y `BreedRepository.findById` (nuevo). Si no existen → 404; si están inactivas → 409; si `breed.speciesId !== speciesId` → 400 «La raza no corresponde a la especie seleccionada».
- `GET /pets/species/:speciesId/breeds` (`ParseUUIDPipe`, `breeds:read`) → `ListActiveBreedsService` → `BreedRepository.findActiveBySpecies(speciesId)`, que devuelve `[{ id, name }]` ordenado por nombre. Se declara en `BreedController`.

### 7. `pets:create` para el Veterinario
- **Decisión**: en `roles.catalog.ts`, el filtro del Veterinario deja de excluir `pets:create` y solo excluye `pets:inactivate` y `pets:activate`. La prueba «el Veterinario actualiza y da de baja pacientes pero no los registra» de `catalogs.spec.ts` pasa a «el Veterinario registra, actualiza y da de baja pacientes» y espera `pets:create` en `true`.
- **Justificación**: la HU-07 nombra al Veterinario entre quienes registran pacientes. El permiso ya existe, así que no hace falta crear ninguno.
- **Despliegue**: el `RbacCatalogSynchronizer` en modo `create-only` solo da a un rol existente los permisos **recién creados**. Como `pets:create` ya existe, una base ya inicializada no se lo dará al Veterinario. Hay dos opciones: ejecutar la sincronización una vez con `rbac.syncMode=strict`, que además repone todo el catálogo, o asignarlo a mano. En una base nueva (`make up-seed`) se aplica solo.
- **Riesgo**: `roles.catalog.ts` es un archivo compartido. Hay que avisar al grupo.

### 8. Estructura de archivos
- **Backend** (`modules/pets/`): `dtos/pets/register-pet.dto.ts`, `repositories/pet.repository.ts`, `services/pets/register-pet.service.ts` (+ `.spec.ts`), `services/pets/birth-date.ts` (+ `.spec.ts`), `services/breeds/list-active-breeds.service.ts` (+ `.spec.ts`), `routes/pets.controller.ts`; todo registrado en `pets.module.ts`. Pruebas e2e en `test/pets/pets.e2e-spec.ts`.
- **Frontend** (`modules/pets/`): `schemas/pet.ts` (+ `.test.ts`), `services/pet.service.ts`, `services/breed.service.ts` (agrega `listActiveBreeds`), `components/pet-form.tsx` (+ `.test.tsx`), `components/client-picker.tsx`, `pages/pets-page.tsx` (+ `.test.tsx`), `pages/pets.css` y los tipos en `types.ts`. En `router.tsx`, `/pets` pasa a `PetsPage`.
- **Modal**: el registro se abre en un modal desde `PetsPage`, igual que razas y especies, en lugar de una ruta propia. El modal mide hasta 820 px y el encabezado solo lleva el título «Datos del paciente». Los campos tienen el mismo ancho en una cuadrícula de 3 columnas (identificación, datos biológicos y medidas), que pasa a 2 en tablet y a 1 en móvil; los botones quedan fijos al pie aunque el formulario haga scroll. Cada campo lleva un ícono; los que faltaban (balanza, regla, paleta, sexo, búsqueda y corazón) se agregan a `common/components/icons.tsx`. Solo se muestra el botón «Nuevo paciente» con `pets:create`.
- El buscador de clientes llama a `GET /clients?status=ACTIVE&search=&pageSize=10` con un retardo de 300 ms y muestra «Nombre Apellido · cédula».
- El campo de fecha usa una máscara de texto `DD-MM-YYYY` en vez de `<input type="date">`, que depende del idioma del navegador.

## Risks / Trade-offs

- **[HU-01 aún no está en `development`]** → La rama de HU-07 tiene HU-01 mergeada. El PR de HU-07 se abre cuando HU-01 entre a `development`; si HU-01 cambia antes, se sincroniza y se resuelven los conflictos.
- **[Errores de tipos en los tests de HU-01]** → `tsc` falla en `clients.repository.spec.ts` y `client-registration.service.spec.ts`. No bloquean HU-07, pero hay que avisar al responsable para que no se mezclen con los fallos propios.
- **[Migraciones concurrentes]** → Avisar al grupo antes de `npx prisma migrate dev --name add_pet_model`. La migración depende de `add_client_model` de HU-01.
- **[Cliente dado de baja mientras se llena el formulario]** → El backend responde 409 y el formulario muestra el mensaje.
- **[Huecos en la secuencia]** → Si una inserción falla después de `nextval`, se pierde ese número. Es aceptable: el código solo tiene que ser único, no consecutivo.

## Migration Plan

1. Avisar al grupo, y en `vet-manage-api` ejecutar `npx prisma migrate dev --name add_pet_model` y `npx prisma generate`. Revisar que el SQL cree `pet_code_seq` antes de la tabla.
2. Desplegar con `make up`. En bases ya inicializadas, sincronizar una vez el RBAC en modo `strict` (o asignar a mano) para que el Veterinario reciba `pets:create`.
3. Rollback: revertir la migración, que elimina la tabla `pets`, la secuencia y los enums. Ninguna otra tabla depende de ellas todavía.

## Open Questions

- Ninguna. Se decidió incluir al Veterinario (decisión 7).
