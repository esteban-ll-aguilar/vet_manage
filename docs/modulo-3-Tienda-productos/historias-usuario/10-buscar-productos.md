# HU-10 · Buscar productos

| Campo | Descripción |
| --- | --- |
| **Nombre** | Buscar productos |
| **Número** | HU-10 |
| **Actor** | Gerente, Bodeguero, Veterinario, Cajero |
| **Requerimientos vinculados** | RF-03 |
| **Módulo responsable** | Tienda de Productos |
| **Dependencias** | HU-01, HU-02 |
| **Estimación** | 5 puntos |
| **Sprint planificado** | Sprint 1 |
| **Responsable** | Elias |

**Historia**

> Como gerente, bodeguero, veterinario o cajero, quiero buscar productos por nombre, categoría, marca, código de lote o precio, para localizar rápidamente los productos en el inventario.

## Criterios de aceptación

### Escenario 1: Buscar un producto por nombre

```gherkin
Dado que el usuario se encuentra en el módulo de productos y existen productos registrados
Cuando ingresa una palabra o parte del nombre de un producto como criterio de búsqueda
Entonces el sistema debe mostrar únicamente los productos que coincidan con el nombre ingresado.
```

### Escenario 2: Buscar productos por categoría

```gherkin
Dado que existen productos registrados en diferentes categorías
Cuando el usuario selecciona una categoría como filtro
Entonces el sistema debe mostrar únicamente los productos que pertenezcan a esa categoría.
```

### Escenario 3: Buscar productos por marca

```gherkin
Dado que existen productos registrados de diferentes marcas
Cuando el usuario selecciona una marca como filtro
Entonces el sistema debe mostrar únicamente los productos que coincidan con la marca seleccionada.
```

### Escenario 4: Buscar un producto por código de lote

```gherkin
Dado que existen lotes registrados y asociados a productos
Cuando el usuario ingresa un código de lote como criterio de búsqueda
Entonces el sistema debe mostrar únicamente los registros que coincidan con el código de lote ingresado.
```

### Escenario 5: Buscar productos por precio

```gherkin
Dado que existen productos registrados con diferentes precios
Cuando el usuario ingresa un precio como criterio de búsqueda
Entonces el sistema debe mostrar únicamente los productos que coincidan con el precio ingresado.
```

### Escenario 6: Búsqueda sin resultados

```gherkin
Dado que el usuario se encuentra en el módulo de productos
Cuando realiza una búsqueda con un criterio que no coincide con ningún registro
Entonces el sistema debe informar que no se encontraron productos y no mostrar registros que no coincidan con el criterio ingresado.
```

### Escenario 7: Buscar mediante varios filtros

```gherkin
Dado que existen productos registrados de distintas categorías y marcas
Cuando el cajero selecciona la categoría «Alimentos» y la marca «Dog Chow»
Entonces el sistema muestra únicamente los productos que cumplen ambos filtros.
```
