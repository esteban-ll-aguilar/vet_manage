## Why

El catálogo de productos (HU-01) ya existe, pero no hay forma de registrar existencias. Este cambio implementa la HU-02 · Registro de entrada de lote (RF-02, RF-04, Módulo 3 – Tienda, Sprint 1): el Bodeguero registra un lote con producto, código, fecha de caducidad y cantidad inicial, y el stock del producto aumenta.

## What Changes

- **Base de datos**: columna `stock` (entero, default 0) en `products` y nueva tabla `batches` (lote) con FK a `products`; migración `add_product_batches`.
- **Backend (`vet-manage-api/`, módulo `inventory`)**:
  - `POST /api/v1/inventory/batches` protegido con JWT y el permiso existente `inventory:register-entry`.
  - Validación en `services/batch-entry-input.service.ts` con un mensaje por campo (producto, código, fecha, cantidad vacía / ≤ 0 / decimal o texto).
  - Creación del lote e incremento del stock en una sola transacción; los datos inválidos no abren transacción.
- **RBAC**: el rol `warehouse_keeper` (Bodeguero) recibe `inventory:read` e `inventory:register-entry`. No se crean permisos nuevos.
- **Frontend (`vet-manage-frontend/`, módulo `inventory`)**: página `Inventario › Entrada de lotes` (`/inventory/batches/new`), formulario con validación local, toast «Entrada de lote registrada correctamente», resumen con las existencias resultantes y columna «Existencias» en Productos.

## Capabilities

### New Capabilities
- `inventory-batch-entry`: registro de entradas de lote y actualización de existencias.

## Impact

- **APIs**: nuevo `POST /api/v1/inventory/batches`; `GET /inventory/products` ahora incluye `stock`.
- **Dependencias**: HU-01 (modelo `Product`), ya integrado en `development`.
- **Fuera de alcance**: listado/consulta de lotes, unicidad del código de lote, salidas y ajustes de stock.
