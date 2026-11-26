# Diagrama de clases — Módulo 3: Tienda de productos y ventas

Este documento describe las clases, enumeraciones y relaciones representadas
en el diagrama de clases del módulo de tienda de productos y ventas.

## Alcance del módulo

El módulo contempla:

- Catálogos de categorías, marcas y productos.
- Lotes y control de movimientos de inventario.
- Promociones.
- Ventas y detalle de ventas.
- Detalle de pago.
- Devoluciones de productos.
- Notificaciones relacionadas con la operación.

La clase `Usuario` se representa como una referencia externa al módulo de
identidad.

## Clases

### Categoria

Representa la clasificación de un producto.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `permiteDevolucion` | Boolean | Indica si la categoría permite devoluciones. |
| `iva` | Integer | Porcentaje o valor de IVA asociado. |
| `nombre` | String | Nombre de la categoría. |

### Marca

Representa la marca comercial de un producto.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `marca` | String | Nombre de la marca. |

### Producto

Representa un producto disponible para inventario y venta.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `categoriaId` | UUID | Referencia a `Categoria` (FK). |
| `marcaId` | UUID | Referencia a `Marca` (FK). |
| `codigo` | String | Código único del producto. |
| `nombre` | String | Nombre del producto. |
| `descripcion` | String | Descripción del producto. |
| `precioUnitario` | Decimal | Precio unitario. |
| `stockMinimo` | Integer | Cantidad mínima de stock permitida. |

### Lote

Representa una existencia de un producto perteneciente a un lote.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `promocionId` | UUID | Referencia a `Promocion` (FK). |
| `productoId` | UUID | Referencia a `Producto` (FK). |
| `codigo` | String | Código del lote. |
| `fechaCaducidad` | Date | Fecha de caducidad. |
| `cantidadDisponible` | Integer | Cantidad disponible en el lote. |

### MovimientoInventario

Registra entradas, salidas y ajustes de existencias.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `loteId` | UUID | Referencia a `Lote` (FK). |
| `tipo` | TipoMovimiento | Tipo de movimiento. |
| `cantidad` | Integer | Cantidad afectada. |
| `saldoAnterior` | Integer | Saldo antes del movimiento. |
| `saldoResultante` | Integer | Saldo después del movimiento. |
| `motivo` | String | Motivo del movimiento. |
| `fechaHora` | DateTime | Fecha y hora del movimiento. |
| `usuarioId` | UUID | Referencia externa al usuario que registra el movimiento. |

### Promocion

Representa una promoción aplicable a un lote.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `porcentaje` | Decimal | Porcentaje de descuento. |
| `fechaInicio` | Date | Inicio de la promoción. |
| `fechaFin` | Date | Fin de la promoción. |
| `precioPromocional` | Decimal | Precio resultante de la promoción. |

### Venta

Representa una venta realizada.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `fechaHora` | DateTime | Fecha y hora de la venta. |
| `estado` | EstadoVenta | Estado actual de la venta. |
| `subtotal` | Decimal | Subtotal de la venta. |
| `descuento` | Decimal | Descuento aplicado. |
| `total` | Decimal | Total de la venta. |
| `detallePagoId` | UUID | Referencia al detalle de pago. |
| `pagado` | UUID | Referencia externa al perfil o usuario relacionado con el pago. |

### DetalleVenta

Representa un producto incluido en una venta.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `cantidad` | Integer | Cantidad vendida. |
| `precioUnitarioAplicado` | Decimal | Precio utilizado en la venta. |
| `porcentajeDescuento` | Decimal | Descuento aplicado al detalle. |
| `subtotal` | Decimal | Subtotal del detalle. |
| `ventaId` | UUID | Referencia a `Venta` (FK). |
| `productoId` | UUID | Referencia a `Producto` (FK). |
| `loteId` | UUID | Referencia a `Lote` (FK). |
| `isActive` | Boolean | Indica si el detalle está activo. |

### DetallePago

Contiene los datos asociados al pago y a la información de facturación o
entrega de la venta.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `fecha` | DateTime | Fecha del pago. |
| `email` | String | Correo electrónico. |
| `direccion` | String | Dirección. |
| `nombres` | String | Nombres del comprador. |
| `apellido` | String | Apellido del comprador. |
| `dni` | String | Identificación del comprador. |
| `telefono` | String | Teléfono del comprador. |

### DevolucionProducto

Representa la devolución de productos pertenecientes a una venta.

| Atributo | Tipo | Descripción |
|---|---|---|
| `loteId` | UUID | Referencia a `Lote` (FK). |
| `id` | UUID | Identificador único (PK). |
| `cantidad` | Integer | Cantidad devuelta. |
| `motivo` | String | Motivo de la devolución. |
| `estadoDevolucion` | EstadoDevolucionTipo | Estado de la devolución. |
| `tipoDevolucion` | DevolucionType | Origen o tipo de devolución. |
| `fechaHora` | DateTime | Fecha y hora de la devolución. |
| `detalleVentaId` | UUID | Referencia a `DetalleVenta` (FK). |

### Notificacion

Representa una notificación dirigida a un usuario del sistema.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `tipoEntidad` | String | Tipo de entidad relacionada. |
| `titulo` | String | Título de la notificación. |
| `entidadId` | String | Identificador del registro relacionado. |
| `mensaje` | String | Mensaje principal. |
| `detalle` | String | Información adicional. |
| `prioridad` | Prioridad | Prioridad de la notificación. |
| `fechaEmitida` | DateTime | Fecha y hora de emisión. |
| `fechaLectura` | DateTime | Fecha y hora en que fue leída. |
| `leida` | Boolean | Indica si la notificación fue leída. |

### TipoNotificacion

Define la clasificación y los destinatarios de una notificación.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único (PK). |
| `nombre` | String | Nombre del tipo de notificación. |
| `descripcion` | String | Descripción del tipo. |
| `code` | String | Código interno. |
| `rolesDestino` | List\<String\> | Roles que pueden recibirla. |
| `activo` | Boolean | Indica si el tipo está activo. |

### Usuario (referencia externa)

Representa al usuario del módulo de identidad que crea, recibe o consulta
información del módulo.

| Atributo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador del usuario. |

En la implementación actual del proyecto, esta referencia puede relacionarse
con el modelo `User` definido en `prisma/schema/identity.prisma`.

## Enumeraciones

### TipoMovimiento

| Valor | Descripción |
|---|---|
| `ENTRADA` | Ingreso de unidades al inventario. |
| `VENTA` | Salida causada por una venta. |
| `USO_CLINICO` | Salida para uso clínico. |
| `AJUSTE` | Corrección manual del inventario. |
| `BAJA` | Retiro o baja de unidades. |

### EstadoVenta

| Valor | Descripción |
|---|---|
| `PAGADO` | La venta fue pagada. |
| `PENDIENTE` | La venta aún está pendiente de pago. |

### EstadoDevolucionTipo

| Valor | Descripción |
|---|---|
| `DEVUELTO` | La devolución fue completada. |
| `EN_PROCESO` | La devolución está siendo gestionada. |
| `RECHAZADO` | La devolución fue rechazada. |
| `ACTIVO` | El registro de devolución permanece activo. |

### DevolucionType

| Valor | Descripción |
|---|---|
| `CLIENTE` | Devolución realizada por un cliente. |
| `VETERINARIA` | Devolución realizada por la veterinaria. |

### Prioridad

| Valor | Descripción |
|---|---|
| `CRITICA` | Requiere atención inmediata. |
| `ALTA` | Requiere atención prioritaria. |
| `MEDIA` | Requiere atención normal. |
| `BAJA` | Tiene baja urgencia. |

## Relaciones

| Relación | Cardinalidad | Descripción |
|---|---:|---|
| `Categoria` → `Producto` | 1:N | Una categoría puede tener varios productos. |
| `Marca` → `Producto` | 1:N | Una marca puede estar asociada a varios productos. |
| `Producto` → `Lote` | 1:N | Un producto puede tener varios lotes. |
| `Promocion` → `Lote` | 0:N | Una promoción puede aplicarse a lotes según su vigencia. |
| `Lote` → `MovimientoInventario` | 1:N | Un lote puede tener varios movimientos. |
| `Usuario` → `MovimientoInventario` | 1:N | Un usuario puede registrar varios movimientos. |
| `Producto` → `DetalleVenta` | 1:N | Un producto puede aparecer en varios detalles de venta. |
| `Lote` → `DetalleVenta` | 1:N | Un lote puede aparecer en varios detalles de venta. |
| `Venta` → `DetalleVenta` | 1:N | Una venta contiene uno o varios detalles. |
| `Venta` → `DetallePago` | 0:1 | Una venta puede tener un detalle de pago. |
| `DetalleVenta` → `DevolucionProducto` | 1:N | Un detalle de venta puede originar devoluciones. |
| `Lote` → `DevolucionProducto` | 1:N | Un lote puede estar asociado a varias devoluciones. |
| `TipoNotificacion` → `Notificacion` | 1:N | Un tipo puede clasificar varias notificaciones. |
| `Usuario` → `Notificacion` | 1:N | Un usuario puede recibir varias notificaciones. |
| `Prioridad` → `Notificacion` | 1:N | Cada notificación tiene una prioridad. |

## Consideraciones para la implementación

- Las claves primarias se representan como UUID.
- Las relaciones con `Categoria`, `Marca`, `Producto`, `Lote`, `Venta` y
  `DetalleVenta` deben implementarse como relaciones Prisma explícitas.
- `usuarioId` debe reutilizar el modelo de identidad existente si el módulo se
  implementa dentro de este repositorio.
- `tipoEntidad` y `entidadId` forman una referencia polimórfica; no deben
  modelarse como una FK directa hacia varias tablas.
- El estado de lectura de una notificación debe conservarse en el historial.
- Las operaciones que modifiquen existencias deben ejecutarse dentro de una
  transacción para mantener consistentes el saldo anterior, el saldo resultante
  y el movimiento registrado.
