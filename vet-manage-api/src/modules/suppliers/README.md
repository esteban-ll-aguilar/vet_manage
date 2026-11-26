# Proveedores — HU-26

El modelo conserva la razón social, el RUC, el estado y las fechas de creación y actualización. `createdAt` y `updatedAt` son marcas de tiempo; no guardan valores anteriores ni forman un historial completo de modificaciones. No se implementa versionado ni auditoría porque la historia no define ese requisito.

La desactivación permanece bloqueada mientras no exista una consulta real de órdenes de compra pendientes. La integración futura debe exponer una operación equivalente a `hasPendingOrders(supplierId): Promise<boolean>`, usando los estados pendientes definidos por la historia de compras. La desactivación debe comprobarla y cambiar `isActive` dentro de una operación transaccional coordinada con la creación y transición de órdenes; una lectura no coordinada antes de actualizar no garantiza la precondición bajo concurrencia.

Hasta que esa integración exista, `PATCH /api/v1/suppliers/:id/deactivate` exige `suppliers:deactivate`, responde con error controlado `503` y no modifica al proveedor.
