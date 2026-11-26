# HU-26 – Registrar y gestionar proveedores

## Información general

| Campo | Información |
|---|---|
| Nombre | Registrar y gestionar proveedores |
| Número | HU-26 |
| Actor | Gerente |
| Requerimientos vinculados | Gestión de proveedores |
| Módulo responsable | Tienda / Inventario |
| Dependencias | — |
| Estimación | 3 puntos |

## Descripción

Como gerente, quiero registrar, consultar, actualizar y desactivar proveedores para mantener su información disponible al gestionar órdenes de compra y devoluciones.

## Criterios de aceptación (Gherkin)

**Escenario: Registrar proveedor**

- Dado que el gerente ingresó la razón social, el RUC y los demás datos obligatorios
- Cuando guarda el registro
- Entonces el sistema almacena al proveedor con estado “Activo” y lo muestra en el listado.

**Escenario: Rechazar un RUC duplicado**

- Dado que ya existe un proveedor con el mismo RUC
- Cuando el gerente intenta registrar otro proveedor
- Entonces el sistema rechaza el registro e informa que el RUC ya está registrado.

**Escenario: Rechazar letras en el campo RUC**

- Dado que el gerente está registrando o actualizando un proveedor.
- Cuando ingresa una o más letras en el campo RUC.
- Entonces el sistema rechaza los caracteres alfabéticos y muestra el mensaje «El RUC solo admite dígitos numéricos», impidiendo guardar un RUC inválido.

**Escenario: Actualizar proveedor**

- Dado que el proveedor está registrado
- Cuando el gerente modifica sus datos y guarda los cambios
- Entonces el sistema actualiza la información y conserva el historial del proveedor.

**Escenario: Desactivar proveedor**

- Dado que el proveedor no tiene órdenes pendientes
- Cuando el gerente lo desactiva
- Entonces deja de estar disponible para nuevas órdenes y se conserva su historial.
