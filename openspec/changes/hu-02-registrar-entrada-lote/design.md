## Modelo

- `Product.stock Int @default(0)`: existencias disponibles.
- `Batch` (`batches`): `id` UUID, `productId` (FK `onDelete: Restrict`), `code` VarChar(50), `expirationDate` Date, `initialQuantity` Int, timestamps. Índices por producto y fecha de caducidad.

## Flujo

1. `RegisterBatchEntryDto` acepta los campos sin transformarlos (`@Allow`), igual que `LoginDto`, para que `validateBatchEntryInput` devuelva el mensaje exacto de cada escenario.
2. Con datos inválidos responde 400 (`message` = único error o «Revisa los datos de la entrada de lote», `errors` = lista) sin tocar la base.
3. Con datos válidos, en `prisma.$transaction`: verifica producto activo (404 si no), crea el lote y hace `stock: { increment }`.
4. Respuesta 201 `{ batch, product: { id, code, name, stock } }` con el mensaje «Entrada de lote registrada correctamente».

## Validación de cantidad

| Entrada | Mensaje |
|---|---|
| vacía / ausente | Debe ingresar la cantidad inicial |
| `0`, `-5` | La cantidad inicial debe ser mayor que cero |
| `2.5`, `abc` | La cantidad inicial debe ser un número entero mayor que cero |

El input de cantidad del frontend es de texto (`inputMode="numeric"`) para poder informar decimales y letras.

## Arranque

`make up` aplica la migración (`prisma migrate deploy`) al iniciar la API. Usuario de prueba: `bodeguero@vetmanage.local` / `Vet12345` tras `make up-seed`.
