# HU-12 · Alertas de caducidad

| Campo | Descripción |
| --- | --- |
| **Nombre** | Alertas de caducidad |
| **Número** | HU-12 |
| **Actor** | Bodeguero, Gerente, Veterinario, Cajero |
| **Requerimiento vinculado** | RF-13 |
| **Módulo responsable** | Tienda de Productos |
| **Dependencia** | HU-02 · Registro de entrada de lote |
| **Estimación** | 5 puntos de historia |
| **Sprint planificado** | Sprint 1 |
| **Responsable** | Walter |

**Historia**

> Como bodeguero, gerente, veterinario o cajero, quiero visualizar las alertas de lotes próximos a caducar o ya caducados, para identificar oportunamente los productos que requieren revisión.

## Criterios de aceptación

### Escenario 1: Lote próximo a caducar

```gherkin
Dado que un lote tiene 10 unidades y faltan exactamente 30 días para su fecha de caducidad
Cuando el sistema realiza la revisión diaria
Entonces el sistema muestra una alerta con el producto, el código del lote, la fecha de caducidad, las unidades disponibles y la etiqueta «Próximo a caducar»
```

### Escenario 2: El lote caduca hoy

```gherkin
Dado que un lote tiene 4 unidades y su fecha de caducidad es la fecha actual
Cuando el sistema realiza la revisión diaria
Entonces el sistema muestra una alerta del lote con la etiqueta «Próximo a caducar»
```

### Escenario 3: Lote caducado

```gherkin
Dado que un lote tiene 5 unidades y su fecha de caducidad fue ayer
Cuando el sistema realiza la revisión diaria
Entonces el sistema muestra una alerta del lote con la etiqueta «Caducado»
```

### Escenario 4: Lote fuera del plazo

```gherkin
Dado que un lote tiene 10 unidades y faltan 31 días para su fecha de caducidad
Cuando el sistema realiza la revisión diaria
Entonces el sistema no muestra ninguna alerta para ese lote
```

### Escenario 5: Lote sin unidades disponibles

```gherkin
Dado que un lote caduca dentro de 5 días y tiene 0 unidades disponibles
Cuando el sistema realiza la revisión diaria
Entonces el sistema no muestra ninguna alerta de caducidad para ese lote
```

### Escenario 6: Cambio en los datos del lote

```gherkin
Dado que un lote con 8 unidades tiene una alerta «Próximo a caducar»
Cuando el usuario cambia y guarda la fecha de caducidad del lote a 45 días desde hoy
Entonces el sistema retira la alerta de ese lote
```

### Escenario 7: No existen alertas

```gherkin
Dado que ningún lote con unidades disponibles está caducado ni caduca dentro de los próximos 30 días
Cuando el usuario abre el panel principal
Entonces el sistema muestra el mensaje «No hay lotes próximos a caducar ni caducados»
```

## Tareas de desarrollo

### Diseño

- Definir el período de los próximos 30 días para las alertas de caducidad.
- Diseñar la lista con producto, código de lote, fecha de caducidad y unidades disponibles.
- Diferenciar las etiquetas «Próximo a caducar» y «Caducado».
- Excluir los lotes sin existencias y los que caducan después de 30 días.
- Definir el mensaje para el panel sin alertas.

### Implementación y pruebas

- Consultar los lotes y evaluar sus fechas de caducidad.
- Mostrar las etiquetas previstas para lotes próximos a caducar y caducados.
- Excluir los lotes sin existencias y fuera del plazo.
- Actualizar la alerta cuando cambie y se guarde la fecha de caducidad.
- Verificar el estado sin alertas y ejecutar los siete escenarios de aceptación.

## Resultado esperado

El sistema muestra alertas para los lotes con existencias que ya caducaron o caducan dentro de los próximos 30 días, y actualiza la lista cuando cambian la fecha de caducidad o las unidades disponibles.
