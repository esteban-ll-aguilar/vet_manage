## 1. Base de datos

- [x] 1.1 Avisar al grupo que se va a cambiar el esquema (y al responsable de HU-01 por la relación en `Client`)
- [x] 1.2 Agregar los enums `PetSex` y `ReproductiveStatus` y el modelo `Pet` en `prisma/schema/pets.prisma`, con el `code` generado por `pet_code_seq`
- [x] 1.3 Agregar las relaciones inversas `pets Pet[]` en `Client`, `Species` y `Breed`
- [x] 1.4 Generar la migración `add_pet_model`, comprobar que crea la secuencia antes de la tabla y ejecutar `npx prisma generate`

## 2. Permisos

- [x] 2.1 Avisar al grupo que se va a cambiar `roles.catalog.ts`
- [x] 2.2 Dar `pets:create` al Veterinario en `roles.catalog.ts` (solo se siguen excluyendo `pets:inactivate` y `pets:activate`)
- [x] 2.3 Actualizar la prueba del Veterinario en `catalogs.spec.ts` para que espere `pets:create` en `true`

## 3. Backend: dominio de clientes

- [x] 3.1 Agregar `ClientsRepository.findById(id)` y `ClientsService.findById(id)`, que devuelven `{ id, status }` o `null`, con pruebas unitarias
- [x] 3.2 Exportar `ClientsService` desde `ClientsModule`

## 4. Backend: razas activas por especie

- [x] 4.1 Agregar `BreedRepository.findById` y `BreedRepository.findActiveBySpecies`
- [x] 4.2 Crear `ListActiveBreedsService` con su `.spec.ts`
- [x] 4.3 Exponer `GET /pets/species/:speciesId/breeds` en `BreedController` con `ParseUUIDPipe` y `breeds:read`

## 5. Backend: registro de paciente

- [x] 5.1 Crear `parseBirthDate` en `services/pets/birth-date.ts` con pruebas de formato, fecha inexistente, fecha futura y fecha de hoy
- [x] 5.2 Crear `RegisterPetDto` sin el campo `code` y `PetRepository.create`
- [x] 5.3 Crear `RegisterPetService` con la validación de campos, cliente, especie, raza, fecha, peso y talla, usando los mensajes de la HU
- [x] 5.4 Pruebas unitarias de `RegisterPetService` que cubran los escenarios 1 a 7 de la HU
- [x] 5.5 Crear `PetsController` con `POST /pets` y `pets:create`, y registrar todo en `PetsModule` importando `ClientsModule`
- [x] 5.6 Pruebas e2e en `test/pets/pets.e2e-spec.ts`: registro exitoso por Recepcionista y por Veterinario con código `PAC-NNNNNN`, código enviado que se ignora, cliente dado de baja, raza de otra especie, 401, 403 y el listado de razas por especie

## 6. Frontend

- [x] 6.1 Agregar los tipos de paciente en `types.ts`, `petApi.registerPet` y `breedApi.listActiveBreeds`
- [x] 6.2 Crear `validatePetDraft` en `schemas/pet.ts` (obligatorios, cliente, fecha `DD-MM-YYYY`, peso y talla) con sus pruebas
- [x] 6.3 Crear `ClientPicker`, que busca clientes activos con retardo
- [x] 6.4 Crear `PetForm`, con la raza dependiente de la especie, los campos faltantes resaltados y sin campo de código, y su prueba
- [x] 6.5 Crear `PetsPage` (estado vacío con «Nuevo paciente») con el registro en un modal, íconos por campo y un toast de confirmación
- [x] 6.6 Actualizar `router.tsx`: `/pets` → `PetsPage`

## 7. Verificación

- [x] 7.1 Ejecutar `npm test` y `npm run test:e2e` en `vet-manage-api`, y `npm test` en `vet-manage-frontend`
- [x] 7.2 Probar en la app los 9 escenarios de la issue #5 con un usuario Recepcionista y otro Veterinario
- [x] 7.3 En la base local ya inicializada, sincronizar el RBAC en modo `strict` y comprobar que el Veterinario tiene `pets:create`
