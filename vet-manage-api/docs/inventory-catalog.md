# Catálogo de inventario

## Flujo HU-01

El frontend expone `Inventario > Productos`, `Inventario > Categorías` e
`Inventario > Marcas`. El alta de producto permite seleccionar referencias
existentes o crear una categoría/marca desde el mismo formulario.

La descripción es opcional. Son obligatorios el código, nombre, categoría,
marca y precio unitario. El precio debe ser mayor que cero y el código es único.

## API

Todas las respuestas exitosas usan el envelope global:

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Producto registrado correctamente",
  "data": {}
}
```

Endpoints:

- `GET /api/v1/inventory/products`
- `GET /api/v1/inventory/products/:id`
- `POST /api/v1/inventory/products`
- `PATCH /api/v1/inventory/products/:id`
- `GET /api/v1/inventory/categories`
- `POST /api/v1/inventory/categories`
- `PATCH /api/v1/inventory/categories/:id`
- `GET /api/v1/inventory/brands`
- `POST /api/v1/inventory/brands`
- `PATCH /api/v1/inventory/brands/:id`

### Búsqueda de productos (HU-10)

La lista admite estos parámetros opcionales:

| Parámetro | Criterio |
| --- | --- |
| `search` | Coincidencia parcial por código, nombre, categoría o marca, sin distinguir mayúsculas. También busca por precio si el texto es un importe válido. |
| `name` | Coincidencia parcial por nombre, sin distinguir mayúsculas. |
| `categoryId` | UUID de la categoría seleccionada. |
| `brandId` | UUID de la marca seleccionada. |
| `brandName` | Coincidencia parcial por marca, sin distinguir mayúsculas. |
| `batchCode` | Código de lote completo, sin distinguir mayúsculas. Devuelve los productos asociados a lotes con ese código. |
| `unitPrice` | Precio con hasta dos decimales. Con decimales busca el importe exacto; sin decimales busca el intervalo de esa unidad monetaria. |

La búsqueda por precio incorpora la indicación de Elías del 19/11/2026:
`15` encuentra precios mayores o iguales a `15.00` y menores que `16.00`;
`15.30` encuentra el precio exacto `15.30`. Esta regla se aplica tanto al
buscador general como al filtro `unitPrice`.

Los filtros conservan los nombres del contrato del catálogo. El modelo Prisma
`Marca` usa el delegado `prisma.marca`; la relación de producto sigue siendo
`brand`, con la clave `brandId`, según el cambio integrado en `development`.

Sin filtros, la API lista todos los productos activos. Con filtros, devuelve
los productos activos que cumplen todos los criterios enviados. Si no hay
coincidencias, la API devuelve `200` con `data: []` y el mensaje
«No se encontraron productos». Los parámetros inválidos devuelven `400`.
El filtro por código de lote usa `Product.batches` y `Batch.code`, integrados
por la HU-02. Busca por coincidencia exacta del código, omite espacios en los
extremos e ignora mayúsculas. Cada producto aparece una vez aunque tenga varios
lotes coincidentes. También admite el código completo en el buscador general.

La pantalla de productos permite seleccionar categoría y marca, ingresar un
código de lote, combinarlos con el buscador general y recuperar el catálogo
mediante «Limpiar filtros».

El controlador permanece en la raíz de `src/modules/inventory/`.
`InventoryService` prepara los filtros y consulta Prisma, siguiendo la
organización existente de registro, edición y entrada de lotes del equipo.

La búsqueda de productos y la consulta de categorías y marcas exige sesión
válida y el permiso `inventory:read`. Los roles Gerente, Bodeguero, Veterinario,
Cajero y Administrador reciben ese permiso en el catálogo de roles. La ruta
de productos en el frontend usa el control de permisos compartido.

El `POST /products` es transaccional. Cada referencia puede enviarse como
`{ "id": "..." }` o `{ "name": "Nueva referencia" }`; con `name` se crea o
reactiva automáticamente.

Las actualizaciones de producto usan el mismo payload del alta y permiten
cambiar código, nombre, descripción, precio, categoría y marca. La descripción
se guarda como `null` si se envía vacía. Los nombres de categorías/marcas y el
código de producto mantienen unicidad; un conflicto responde `409` y un ID
inexistente responde `404`.

En la interfaz, categorías y marcas se editan inline desde sus listas. Los
productos se editan mediante `/inventory/products/:id/edit`, reutilizando el
formulario de registro y mostrando resultados mediante el toast global.

## Pruebas

La validación pura está en `src/modules/inventory/services/product-input.service.ts`
y sus tests cubren producto válido, campos obligatorios, precio cero/negativo y
descripción vacía. Los tests del servicio cubren creación inline, actualización
de referencias y productos, precio no positivo, IDs inexistentes y conflictos
por código/nombre. Para HU-10 se comprueban los filtros individuales y
combinados, la búsqueda sin coincidencias y la validación de parámetros.
La validación manual del flujo completo se ejecuta contra el compose levantado.

### Verificación de HU-10 del 19/11/2026

- Backend: 203 pruebas unitarias aprobadas en la suite completa.
- HTTP de inventario: 25 pruebas aprobadas entre HU-02 y HU-10.
- Frontend de inventario: 25 pruebas aprobadas.
- Compilación, comprobación de tipos y lint de los archivos afectados correctos.
- PostgreSQL: comprobados código exacto de lote, diferencias de mayúsculas,
  filtros combinados, precio `15.30` al consultar `15`, búsqueda vacía y
  producto único aunque tenga varios lotes con el mismo código. Los datos
  temporales de esta verificación se revirtieron al terminar.

Comandos desde `vet-manage-api`:

```powershell
npm.cmd test
npm.cmd run test:e2e -- test/inventory/
npm.cmd run build
```

Comandos desde `vet-manage-frontend`:

```powershell
npm.cmd test -- inventory
npm.cmd run build
```

El diseño y la ejecución de casos en el Excel del equipo corresponden al
revisor asignado, Walter. Esa evaluación funcional queda pendiente de registrar.

## Datos demo

El seed de Inventory está separado en `seed/inventory.seed.ts` y crea
categorías, marcas y productos de ejemplo. No crea usuarios, roles ni
permisos.

```bash
make up-podman-seed
# o
make up-seed
```

El seed usa `upsert` por nombre de categoría/marca y por código de producto,
por lo que puede ejecutarse varias veces sin duplicar registros. El comando
`make up-podman` continúa levantando la aplicación sin cargar datos demo.

## Flujo HU-02 · Entrada de lote

`Inventario > Entrada de lotes` registra un lote (producto, código, fecha de
caducidad y cantidad inicial) y suma la cantidad a `products.stock`.

- `POST /api/v1/inventory/batches` — requiere `inventory:register-entry`
  (rol Bodeguero).
- Cuerpo: `{ "productId", "code", "expirationDate": "YYYY-MM-DD", "initialQuantity" }`.
- `Batch.availableQuantity` inicia con la cantidad registrada; el producto conserva
  su stock agregado.
- La cantidad debe ser un entero mayor que cero. Los datos inválidos responden
  `400` sin crear el lote ni modificar existencias; producto inexistente `404`.
- El lote y el incremento de stock se guardan en una sola transacción.

## HU-12 · Alertas de caducidad

`GET /api/v1/inventory/expiration-alerts` requiere `inventory:read` y se consulta
al abrir o actualizar el panel principal. La respuesta se calcula desde los
lotes actuales, así que un cambio de fecha o existencias se refleja en la
siguiente consulta, sin conservar alertas obsoletas.

`PATCH /api/v1/inventory/batches/:id/expiration-date` permite al Bodeguero,
con `inventory:register-entry`, guardar una nueva fecha desde la fila de alerta.
El dashboard vuelve a consultar la lista después de guardar.

- Solo incluye lotes con `availableQuantity > 0` y caducidad hasta hoy + 30 días.
- Fechas anteriores a hoy se etiquetan `Caducado`; hoy y los próximos 30 días,
  inclusive, se etiquetan `Próximo a caducar`.
- `Batch.availableQuantity` representa el saldo del lote. La entrada HU-02 lo
  inicializa con `initialQuantity`; los movimientos posteriores deben ajustar
  el saldo del lote además del stock agregado del producto.
- La suite `test/inventory/expiration-alerts.e2e-spec.ts` comprueba límites,
  lotes sin existencias, actualización de fecha, lista vacía y permisos.

### Resultados de los siete escenarios

Verificados el 2026-11-19 contra la API local con un lote de prueba; la consulta
se ejecuta de nuevo con los valores actuales de la tabla `batches`.

| # | Datos del lote | Resultado |
|---|---|---|
| 1 | 10 unidades, caduca en 30 días | Aparece con producto, lote, fecha, unidades y «Próximo a caducar». |
| 2 | 4 unidades, caduca hoy | «Próximo a caducar». |
| 3 | 5 unidades, caducó ayer | «Caducado». |
| 4 | 10 unidades, caduca en 31 días | No aparece. |
| 5 | 0 unidades, caduca en 5 días | No aparece. |
| 6 | 8 unidades; fecha guardada de +10 a +45 días desde la fila de alerta | Desaparece en la siguiente consulta. |
| 7 | Ningún lote cumple las reglas | API devuelve `[]`; el dashboard presenta «No hay lotes próximos a caducar ni caducados». |

HU-02 implementó el alta de lotes; HU-12 agrega la edición mínima de fecha que
requiere el escenario 6.
