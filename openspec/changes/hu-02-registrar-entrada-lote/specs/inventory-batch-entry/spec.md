## Purpose

Entradas de lote del Módulo 3 (Tienda): el Bodeguero registra lotes de productos y las existencias se actualizan.

## ADDED Requirements

### Requirement: Registro de entrada de lote
El sistema SHALL permitir a un usuario autenticado con el permiso `inventory:register-entry` registrar un lote con producto, código, fecha de caducidad y cantidad inicial, y SHALL sumar la cantidad al stock del producto en la misma transacción.

#### Scenario: Registrar correctamente la entrada de un lote
- **WHEN** el Bodeguero envía `POST /api/v1/inventory/batches` con el producto «Alimento para perro», el código «L-2026-001», la caducidad «2027-10-23» y la cantidad «50»
- **THEN** el sistema registra el lote, aumenta en 50 unidades el stock del producto y responde 201 con el mensaje «Entrada de lote registrada correctamente»

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `inventory:register-entry` intenta registrar una entrada
- **THEN** el sistema responde 403 y no modifica el inventario

### Requirement: Validación de la entrada de lote
El sistema SHALL rechazar con HTTP 400 cualquier entrada incompleta o con cantidad inválida, sin crear el lote ni modificar las existencias.

#### Scenario: Sin producto
- **WHEN** no se selecciona un producto
- **THEN** el sistema indica «Debe seleccionar un producto»

#### Scenario: Sin código de lote
- **WHEN** el código del lote está vacío
- **THEN** el sistema indica «Debe ingresar el código del lote»

#### Scenario: Sin fecha de caducidad
- **WHEN** la fecha de caducidad está vacía
- **THEN** el sistema indica «Debe ingresar la fecha de caducidad»

#### Scenario: Sin cantidad inicial
- **WHEN** la cantidad inicial está vacía
- **THEN** el sistema indica «Debe ingresar la cantidad inicial»

#### Scenario: Cantidad cero o negativa
- **WHEN** la cantidad inicial es «0» o «-5»
- **THEN** el sistema muestra «La cantidad inicial debe ser mayor que cero»

#### Scenario: Cantidad decimal o con letras
- **WHEN** la cantidad inicial es «2.5» o «abc»
- **THEN** el sistema indica «La cantidad inicial debe ser un número entero mayor que cero»

#### Scenario: Producto inexistente
- **WHEN** el producto enviado no existe o está inactivo
- **THEN** el sistema responde 404 «El producto seleccionado no existe»
