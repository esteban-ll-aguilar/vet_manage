# HU-30 · Consultar notificaciones del módulo

| Campo | Descripción |
| --- | --- |
| **Nombre** | Consultar notificaciones del módulo |
| **Número** | HU-30 |
| **Actor** | Gerente, Bodeguero |
| **Requerimientos vinculados** | Consulta e historial de notificaciones |
| **Módulo responsable** | Tienda / Inventario |
| **Dependencias** | Ninguna. Las historias que generan alertas deben guardar las notificaciones que esta HU permita consultar. |
| **Estimación** | 5 puntos |

**Historia**

> Como Gerente o Bodeguero, quiero consultar las notificaciones generadas por las funcionalidades del módulo, para revisar sus detalles y acceder al registro relacionado.

## Criterios de aceptación

### Escenario 1: Mostrar notificaciones

```gherkin
Dado que el sistema tiene notificaciones disponibles para el usuario
Cuando el usuario abre el componente de notificaciones
Entonces el sistema debe mostrar el título, la fecha, el estado y el registro relacionado de cada notificación.
```

### Escenario 2: Marcar una notificación como leída

```gherkin
Dado que el usuario tiene una notificación sin leer
Cuando el usuario marca la notificación como leída
Entonces el sistema debe cambiar su estado de lectura y conservarla en el historial.
```

### Escenario 3: Abrir el registro relacionado

```gherkin
Dado que una notificación está vinculada con un producto, lote u otro registro
Cuando el usuario selecciona la notificación
Entonces el sistema debe abrir el registro si el usuario tiene permiso para consultarlo.
```

### Escenario 4: Mostrar notificaciones cuando no existen registros

```gherkin
Dado que el usuario no tiene notificaciones disponibles
Cuando el usuario abre el componente de notificaciones
Entonces el sistema debe mostrar un mensaje indicando que no existen notificaciones.
```

### Escenario 5: Mantener las notificaciones después de consultarlas

```gherkin
Dado que el usuario tiene notificaciones registradas
Cuando cierra y vuelve a abrir el componente de notificaciones
Entonces el sistema debe conservar las notificaciones y sus respectivos estados de lectura.
```

### Escenario 6: Restringir el acceso a registros relacionados

```gherkin
Dado que una notificación está vinculada con un registro que el usuario no tiene permiso para consultar
Cuando el usuario intenta abrir dicho registro
Entonces el sistema debe impedir el acceso y mostrar un mensaje indicando que no tiene permisos suficientes.
```