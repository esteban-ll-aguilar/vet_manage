## Why

Ya existen clientes (HU-01), especies (HU-13) y razas (HU-17), pero todavía no se puede registrar un paciente. Sin pacientes no hay historia clínica, vacunas ni consultas. Este cambio implementa la HU-07 · Registrar datos del paciente (issue #5): se registra un paciente asociado a un cliente activo, clasificado por especie y raza, y el sistema le asigna un código identificador único.

## What Changes

- **Base de datos**: nuevo modelo `Pet` en `prisma/schema/pets.prisma` con nombre, especie, raza, sexo, fecha de nacimiento, peso (kg), talla (cm), estado reproductivo, color opcional, estado (`RecordStatus`, por defecto `ACTIVE`), cliente dueño y un código identificador único generado por la base de datos (`PAC-000001`). Incluye los enums `PetSex` y `ReproductiveStatus` y su migración.
- **Backend (`vet-manage-api/`, módulo `pets`)**:
  - `POST /api/v1/pets` protegido con JWT y el permiso `pets:create`.
  - Validaciones: campos obligatorios, fecha de nacimiento en formato `DD-MM-YYYY` que exista y no sea futura, peso y talla numéricos mayores que cero, especie activa, raza activa que pertenezca a la especie y cliente existente con estado activo.
  - `GET /api/v1/pets/species/:speciesId/breeds` protegido con `breeds:read`, que devuelve las razas activas de una especie para el selector.
  - La validación del cliente usa el servicio del dominio `clients`, como piden las reglas del grupo: `ClientsModule` exporta `ClientsService` con un método `findById`.
  - Pruebas unitarias de los servicios y pruebas e2e de los endpoints.
- **Permisos**: el Veterinario recibe `pets:create` en `roles.catalog.ts`, como pide la HU. Se actualiza la prueba de `catalogs.spec.ts` que hoy lo prohíbe.
- **Frontend (`vet-manage-frontend/`, módulo `pets`)**:
  - La ruta `/pets` deja de ser un marcador «próximamente» y muestra la página de pacientes con el botón «Nuevo paciente».
  - Formulario de registro en un modal, con íconos en cada campo, todos del mismo ancho en tres columnas, que pasan a una en móvil: buscador de clientes activos, especie, raza (filtrada por especie), sexo, fecha de nacimiento, peso, talla, estado reproductivo y color opcional. El código identificador no aparece como campo editable y al guardar se confirma con un toast de éxito; el código se mostrará en la ficha del paciente (HU-12).
  - Pruebas de la validación del formulario con vitest.

## Capabilities

### New Capabilities
- `patient-registration`: registro de pacientes asociados a un cliente activo, sus validaciones, la generación automática del código identificador y el control de acceso.

### Modified Capabilities
- `breed-catalog`: se agrega la consulta de razas activas de una especie, que usa el formulario de pacientes.

## Impact

- **Base de datos**: nueva tabla `pets` con claves foráneas a `clients`, `species` y `breeds`, una secuencia para el código y dos enums nuevos; migración `add_pet_model`. Hay que avisar al grupo antes de generarla, porque solo una persona cambia el esquema a la vez.
- **APIs**: nuevos `POST /api/v1/pets` y `GET /api/v1/pets/species/:speciesId/breeds`. Se reutilizan `GET /api/v1/pets/species/active` (HU-17) y `GET /api/v1/clients?status=ACTIVE` (HU-01).
- **Permisos**: usa `pets:create`, `breeds:read`, `species:read` y `clients:read`, que ya existen; no se crean permisos nuevos. Recepcionista y Gerente ya los tienen. Al Veterinario se le agrega `pets:create` en `roles.catalog.ts` (archivo compartido: hay que avisar al grupo). En bases ya creadas, el sincronizador en modo `create-only` no agrega ese permiso a un rol existente; ver el diseño.
- **Archivos compartidos del frontend**: se agregan 6 íconos (balanza, regla, paleta, sexo, búsqueda y corazón) a `common/components/icons.tsx`; hay que mencionarlo en el PR.
- **Código de otro dominio**: cambio pequeño en `modules/clients/` (exportar `ClientsService` y agregar `findById`). Hay que avisar al responsable de HU-01.
- **Dependencias**: HU-01 (rama `feature/modulo1/HU-01-regisrar-cliente`, todavía sin PR aceptado), HU-13 y HU-17 (ya en `development`). El PR de HU-07 debe abrirse después de que HU-01 entre a `development`, o mostrará los commits de HU-01.
