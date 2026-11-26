# HU-02 · Registro de entrada de lote — resultados de aceptación

Ejecutado el 2026-11-19 contra `make up` + seed, usuario `bodeguero@vetmanage.local`,
producto «Alimento para perro» con stock inicial 0.

| # | Escenario | Resultado | Stock después |
|---|---|---|---|
| 1 | Lote `L-2026-001`, caducidad `2027-10-23`, cantidad `50` | 201 «Entrada de lote registrada correctamente» | 50 |
| 2 | Sin producto | 400 «Debe seleccionar un producto» | 50 (sin cambios) |
| 3 | Sin código de lote | 400 «Debe ingresar el código del lote» | 50 |
| 4 | Sin fecha de caducidad | 400 «Debe ingresar la fecha de caducidad» | 50 |
| 5 | Sin cantidad inicial | 400 «Debe ingresar la cantidad inicial» | 50 |
| 6 | Cantidad `0` | 400 «La cantidad inicial debe ser mayor que cero» | 50 |
| 7 | Cantidad `-5` | 400 «La cantidad inicial debe ser mayor que cero» | 50 |
| 8 | Cantidad `2.5` / `abc` | 400 «La cantidad inicial debe ser un número entero mayor que cero» | 50 |

Control de acceso: Administrador (sin `inventory:register-entry`) → 403; sin sesión → 401.
En la tabla `batches` quedó un solo registro (`L-2026-001`), confirmando que los rechazos no crean lotes.
