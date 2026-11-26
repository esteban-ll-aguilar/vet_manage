## 1. Modelo de datos

- [x] 1.1 Agregar `stock` a `Product` y el modelo `Batch` en `prisma/schema/inventory.prisma`.
- [x] 1.2 Generar la migración `add_product_batches` y verificar que solo agrega la columna y la tabla.

## 2. Backend

- [x] 2.1 `services/batch-entry-input.service.ts` + spec con los 8 escenarios.
- [x] 2.2 `dtos/register-batch-entry.dto.ts`.
- [x] 2.3 `InventoryService.registerBatchEntry` transaccional + specs (éxito, inválido sin transacción, producto inexistente).
- [x] 2.4 `POST /inventory/batches` con `@RequirePermissions('inventory:register-entry')`; `InventoryModule` importa `IdentityModule`.
- [x] 2.5 Asignar `inventory:read` e `inventory:register-entry` al Bodeguero y actualizar `catalogs.spec.ts`.
- [x] 2.6 `test/inventory/batch-entry.e2e-spec.ts`: escenarios 1–8, 404, 401 y 403.

## 3. Frontend

- [x] 3.1 Tipos `BatchEntryDraft`, `BatchEntryResult` y `stock` en `Product`.
- [x] 3.2 `schemas/batch-entry.ts` con los mismos mensajes que la API.
- [x] 3.3 `components/batch-entry-form.tsx` + `batch-entry-form.test.tsx` (escenarios 1–8 y error de API).
- [x] 3.4 `pages/batch-entry-page.tsx`, ruta protegida y enlace «Entrada de lotes» en el menú Inventario.
- [x] 3.5 Columna «Existencias» en Productos.

## 4. Verificación

- [x] 4.1 API: build, lint, 173 tests unitarios y 98 e2e en verde.
- [x] 4.2 Frontend: `tsc -b`, lint y 47 tests en verde.
- [x] 4.3 Escenarios 1–8 ejecutados contra Compose con el usuario Bodeguero (ver README.md del cambio).
