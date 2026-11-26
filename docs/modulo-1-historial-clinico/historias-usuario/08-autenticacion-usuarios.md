# Autenticación, usuarios y auditoría

Historias de usuario del Módulo 1 – Historial Clínico (HU-51 a HU-61).

| HU | Nombre | Actor |
| --- | --- | --- |
| HU-51 | Registrar usuario | Administrador |
| HU-52 | Consultar usuarios | Administrador |
| HU-53 | Actualizar datos de usuario | Administrador |
| HU-54 | Asignar y quitar roles al usuario | Administrador |
| HU-55 | Activar e inactivar cuenta de usuario | Administrador |
| HU-56 | Gestionar permisos por rol | Administrador |
| HU-57 | Iniciar sesión | Todos los roles del sistema |
| HU-58 | Recuperar contraseña | Todos los roles del sistema |
| HU-59 | Cambiar contraseña | Todos los roles del sistema |
| HU-60 | Consultar y exportar auditoría del sistema | Administrador |
| HU-61 | Dar de baja usuario | Administrador |

## HU-51 · Registrar usuario

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-55 |

**Historia**

> Como Administrador, quiero registrar a los usuarios del personal con uno o mas roles, nombres, apellidos, cédula, correo, teléfono (opcional) y una contraseña temporal, para que puedan acceder al sistema según sus funciones.

**Criterios de aceptación**

#### Escenario 1: Registro exitoso con un rol

```gherkin
Dado que el Administrador se encuentra en el formulario de registro de personal.
Cuando ingresa cédula, nombres, apellidos, correo y teléfono válidos, selecciona el rol "Veterinario" y presiona "Guardar".
Entonces el sistema debe crear la cuenta en estado "Activo" con el rol Veterinario y una contraseña temporal.
Y debe enviar las credenciales al correo registrado.
Y debe mostrar el mensaje "Usuario registrado correctamente".
```

#### Escenario 2: Registro con varios roles

```gherkin
Dado que el Administrador se encuentra en el formulario de registro de personal.
Cuando registra a un nuevo usuario y selecciona los roles "Gerente" y "Administrador".
Entonces el sistema debe crear una sola cuenta con ambos roles asignados.
```

#### Escenario 3: La persona ya es Cliente de la clínica

```gherkin
Dado que "Ana Ruiz" tiene una cuenta como Cliente con la cédula "1105555555".
Cuando el Administrador la registra como personal con el rol "Cajero".
Entonces el sistema no debe duplicar a la persona.
Y debe agregar el rol Cajero a su cuenta existente.
```

#### Escenario 4: Campos obligatorios vacíos

```gherkin
Dado que el Administrador se encuentra en el formulario de registro de personal.
Cuando deja vacío el correo o no selecciona ningún rol y presiona "Guardar".
Entonces el sistema no debe crear la cuenta.
Y debe resaltar los campos faltantes con el mensaje "Complete los campos obligatorios".
```

#### Escenario 5: Cédula ya registrada en el personal

```gherkin
Dado que existe un usuario del personal con la cédula "1104567890".
Cuando el Administrador intenta registrar otro usuario con esa cédula.
Entonces el sistema debe rechazar el registro.
Y debe mostrar el mensaje "Número de cédula ya registrado".
```

#### Escenario 6: Cédula con formato inválido

```gherkin
Dado que el Administrador se encuentra en el formulario de registro de personal.
Cuando ingresa la cédula "11045" y presiona "Guardar".
Entonces el sistema debe rechazar el registro.
Y debe mostrar el mensaje "La cédula debe tener 10 dígitos válidos".
```

#### Escenario 7: Correo ya registrado

```gherkin
Dado que el correo "mlopez@vetmanage.com" ya pertenece a otro usuario.
Cuando el Administrador intenta registrar un nuevo usuario con ese correo.
Entonces el sistema debe rechazar el registro.
Y debe mostrar el mensaje "El correo ya se encuentra registrado".
```

#### Escenario 8: Falla el envío del correo

```gherkin
Dado que el Administrador registró correctamente a un nuevo usuario.
Cuando el sistema no logra enviar el correo con las credenciales.
Entonces la cuenta debe quedar creada.
Y debe mostrar el mensaje "Usuario registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales".
```

#### Escenario 9: Usuario sin permiso

```gherkin
Dado que un Recepcionista inició sesión.
Cuando intenta abrir el formulario de registro de personal.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---

## HU-52 · Consultar usuarios

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-56 |

**Historia**

> Como Administrador, quiero consultar la lista de usuarios y buscarlos por cédula, nombre, rol o estado, para ubicar rápidamente la cuenta que necesito gestionar.

**Criterios de aceptación**

#### Escenario 1: Lista inicial

```gherkin
Dado que existen 45 usuarios registrados.
Cuando el Administrador abre la consulta de usuarios.
Entonces el sistema debe mostrar los usuarios ordenados por apellido en páginas de 20.
Y cada fila debe mostrar cédula, nombre, correo, roles y estado.
```

#### Escenario 2: Búsqueda por cédula

```gherkin
Dado que existe el usuario "Carlos Pérez" con la cédula "1104567890".
Cuando el Administrador busca la cédula "1104567890".
Entonces el sistema debe mostrar a "Carlos Pérez" con su correo, roles y estado.
```

#### Escenario 3: Búsqueda por nombre parcial

```gherkin
Dado que existen los usuarios "Carlos Pérez" y "Ana Pérez".
Cuando el Administrador escribe "Pérez" en el buscador.
Entonces el sistema debe mostrar a los dos usuarios.
```

#### Escenario 4: Filtrar por rol

```gherkin
Dado que existen 3 Veterinarios y 2 Recepcionistas registrados.
Cuando el Administrador filtra por el rol "Veterinario".
Entonces el sistema debe mostrar solo los 3 Veterinarios.
Y si alguno tiene otro rol además de Veterinario, debe mostrar todos sus roles.
```

#### Escenario 5: Filtrar por estado

```gherkin
Dado que existen 2 usuarios inactivos y 1 dado de baja.
Cuando el Administrador filtra por el estado "Inactivo
Entonces el sistema debe mostrar solo los 2 usuarios inactivos.
```

#### Escenario 6: Filtros combinados

```gherkin
Dado que existen Veterinarios activos e inactivos.
Cuando el Administrador filtra por el rol "Veterinario" y el estado "Activo".
Entonces el sistema debe mostrar solo los Veterinarios activos.
```

#### Escenario 7: Búsqueda sin resultados

```gherkin
Dado que no existe ningún usuario con la cédula "0000000000".
Cuando el Administrador busca esa cédula.
Entonces el sistema debe mostrar el mensaje "No se encontraron usuarios".
```

#### Escenario 8: Usuario sin permiso

```gherkin
Dado que un Cajero inició sesión.
Cuando intenta abrir la consulta de usuarios.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---

## HU-53 · Actualizar datos de usuario

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-57 |

**Historia**

> Como Administrador, quiero actualizar el nombre, apellido, correo y teléfono de un usuario, para mantener su información de contacto al día.

**Criterios de aceptación**

#### Escenario 1: Actualización exitosa

```gherkin
Dado que el usuario "Carlos Pérez" tiene el teléfono "0991111111".
Cuando el Administrador cambia el teléfono a "0992222222" y presiona "Guardar".
Entonces el sistema debe guardar el nuevo teléfono.
Y debe mostrar el mensaje "Datos actualizados correctamente".
```

#### Escenario 2: Cambio de correo

```gherkin
Dado que "Carlos Pérez" inicia sesión con "[cperez@correo.com](mailto:cperez@correo.com)".
Cuando el Administrador cambia su correo a "carlos.perez@correo.com" y presiona "Guardar".
Entonces Carlos debe iniciar sesión con el nuevo correo.
Y el sistema debe enviar un aviso del cambio al correo anterior.
```

#### Escenario 3: Correo usado por otro usuario

```gherkin
Dado que el correo "ana@correo.com" pertenece a otro usuario.
Cuando el Administrador intenta asignar ese correo a "Carlos Pérez".
Entonces el sistema debe impedir el guardado.
Y debe mostrar el mensaje "El correo ya se encuentra registrado".
```

#### Escenario 4: Correo o teléfono con formato inválido

```gherkin
Dado que el Administrador está editando a "Carlos Pérez".
Cuando ingresa el correo "carlos@" o el teléfono "0991" y presiona "Guardar".
Entonces el sistema debe impedir el guardado.
Y debe señalar el campo con el mensaje "Formato no válido".
```

#### Escenario 5: Campo obligatorio vacío

```gherkin
Dado que el Administrador está editando a "Carlos Pérez".
Cuando borra el nombre y presiona "Guardar".
Entonces el sistema debe impedir el guardado.
Y debe mostrar el mensaje "Complete los campos obligatorios".
```

#### Escenario 6: Cédula no editable

```gherkin
Dado que el Administrador abre el formulario de edición de un usuario.
Cuando revisa el campo de número de cédula.
Entonces el campo debe mostrarse bloqueado y no permitir cambios.
```

#### Escenario 7: Cancelar la edición

```gherkin
Dado que el Administrador cambió el teléfono de "Carlos Pérez" sin guardar.
Cuando presiona "Cancelar".
Entonces el sistema debe conservar los datos anteriores.
```

#### Escenario 8: Usuario dado de baja

```gherkin
Dado que el usuario "Luis Ríos" fue dado de baja
Cuando el Administrador abre su ficha.
Entonces el sistema debe mostrar sus datos solo para consulta, sin opción de editar.
```

#### Escenario 9: Usuario sin permiso

```gherkin
Dado que un Gerente inició sesión.
Cuando intenta editar los datos de otro usuario.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción". .
```

---

## HU-54 · Asignar y quitar roles al usuario

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-58 |

**Historia**

> Como Administrador, quiero asignar o quitar roles a un usuario del personal, para ajustar sus accesos cuando cambian sus funciones en la clínica.

**Criterios de aceptación**

#### Escenario 1: Asignar un rol adicional

```gherkin
Dado que "Carlos Pérez" tiene el rol Recepcionista.
Cuando el Administrador le asigna el rol "Cajero" y presiona "Guardar".
Entonces Carlos debe quedar con los roles Recepcionista y Cajero.
Y debe ver las funciones de ambos roles en su siguiente inicio de sesión.
```

#### Escenario 2: Quitar un rol

```gherkin
Dado que "Carlos Pérez" tiene los roles Recepcionista y Cajero.
Cuando el Administrador le quita el rol "Cajero" y presiona "Guardar".
Entonces Carlos debe quedar solo con el rol Recepcionista.
Y no debe ver las funciones de Cajero en su siguiente inicio de sesión.
```

#### Escenario 3: Cambiar de función

```gherkin
Dado que "Carlos Pérez" tiene el rol Recepcionista.
Cuando el Administrador le quita Recepcionista, le asigna "Veterinario" y presiona "Guardar".
Entonces Carlos debe quedar solo con el rol Veterinario.
Y debe ver las funciones de Veterinario en su siguiente inicio de sesión.
```

#### Escenario 4: Quitar el único rol

```gherkin
Dado que "Carlos Pérez" tiene solo el rol Recepcionista.
Cuando el Administrador intenta quitárselo sin asignar otro.
Entonces el sistema debe impedir el cambio.
Y debe mostrar el mensaje "El usuario debe tener al menos un rol".
```

#### Escenario 5: Quitar el último Administrador

```gherkin
Dado que solo existe un usuario activo con el rol Administrador.
Cuando se intenta quitarle ese rol.
Entonces el sistema debe impedir el cambio.
Y debe mostrar el mensaje "Debe existir al menos un Administrador activo".
```

#### Escenario 6: Rol ya asignado

```gherkin
Dado que "Carlos Pérez" ya tiene el rol Recepcionista.
Cuando el Administrador abre la lista de roles para asignar.
Entonces el rol Recepcionista no debe aparecer como opción.
```

#### Escenario 7: Usuario dado de baja

```gherkin
Dado que el usuario "Luis Ríos" fue dado de baja.
Cuando el Administrador intenta asignarle un rol.
Entonces el sistema debe impedir el cambio.
Y debe mostrar el mensaje "No se pueden modificar los roles de un usuario dado de baja".
```

#### Escenario 8: Usuario sin permiso

```gherkin
Dado que un Veterinario inició sesión.
Cuando intenta cambiar los roles de otro usuario.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---

## HU-55 · Activar e inactivar cuenta de usuario

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-59 |

**Historia**

> Como Administrador, quiero inactivar o activar la cuenta de un usuario, para impedir su acceso de forma temporal (por ejemplo, vacaciones o suspensión) sin perder los registros que realizó.

**Criterios de aceptación**

#### Escenario 1: Inactivación exitosa

```gherkin
Dado que el Veterinario "Luis Torres" tiene una cuenta activa.
Cuando el Administrador inactiva su cuenta y confirma la acción.
Entonces la cuenta debe quedar en estado "Inactivo".
Y el sistema debe conservar las atenciones clínicas que Luis registró.
```

#### Escenario 2: Inicio de sesión con cuenta inactiva

```gherkin
Dado que la cuenta de "Luis Torres" está inactiva.
Cuando Luis intenta iniciar sesión con sus credenciales.
Entonces el sistema debe negar el acceso.
Y debe mostrar el mensaje "Su cuenta se encuentra desactivada. Contacte al administrador".
```

#### Escenario 3: Usuario con sesión abierta

```gherkin
Dado que "Luis Torres" tiene una sesión abierta.
Cuando el Administrador inactiva su cuenta.
Entonces el sistema debe cerrar la sesión de Luis en su siguiente acción.
```

#### Escenario 4: Activación de una cuenta inactiva

```gherkin
Dado que la cuenta de "Luis Torres" está inactiva.
Cuando el Administrador la reactiva.
Entonces la cuenta debe quedar en estado "Activo".
Y Luis debe poder iniciar sesión con sus mismas credenciales y roles.
```

#### Escenario 5: Cancelar la inactivación

```gherkin
Dado que el Administrador presionó "Inactivar" sobre la cuenta de "Luis Torres".
Cuando presiona "Cancelar" en el mensaje de confirmación.
Entonces la cuenta debe seguir activa.
```

#### Escenario 6: Último Administrador activo

```gherkin
Dado que solo existe un Administrador activo.
Cuando se intenta inactivar su cuenta.
Entonces el sistema debe impedir la acción.
Y debe mostrar el mensaje "Debe existir al menos un Administrador activo".
```

#### Escenario 7: Inactivar la propia cuenta

```gherkin
Dado que el Administrador "Jorge Solís" inició sesión.
Cuando intenta inactivar su propia cuenta.
Entonces el sistema debe impedir la acción.
Y debe mostrar el mensaje "No puede inactivar su propia cuenta".
```

#### Escenario 8: Usuario sin permiso

```gherkin
Dado que un Recepcionista inició sesión.
Cuando intenta inactivar la cuenta de otro usuario.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---

## HU-56 · Gestionar permisos por rol

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-60 |

**Historia**

> Como Administrador, quiero activar o desactivar los permisos de consultar, registrar, actualizar y dar de baja de cada rol en cada módulo, para que cada usuario use solo las funciones que le corresponden.

**Criterios de aceptación**

#### Escenario 1: Asignar un permiso

```gherkin
Dado que el rol Recepcionista no tiene permiso para "Registrar cliente".
Cuando el Administrador activa ese permiso y presiona "Guardar".
Entonces el sistema debe guardar el cambio.
Y los Recepcionistas deben ver la opción "Registrar cliente" en su siguiente inicio de sesión.
```

#### Escenario 2: Retirar un permiso

```gherkin
Dado que el rol Cajero tiene permiso para "Consultar historia clínica".
Cuando el Administrador desactiva ese permiso y presiona "Guardar".
Entonces los Cajeros no deben ver la opción "Consultar historia clínica" en su siguiente inicio de sesión.
```

#### Escenario 3: Usuario con varios roles

```gherkin
Dado que "Carlos Pérez" tiene los roles Cajero y Recepcionista.
Y el rol Cajero no tiene permiso para "Registrar cliente", pero el rol Recepcionista sí.
Cuando Carlos inicia sesión.
Entonces debe poder usar la opción "Registrar cliente".
```

#### Escenario 4: Acceso directo a una función sin permiso

```gherkin
Dado que el rol Cajero no tiene permiso para "Consultar historia clínica".
Cuando un Cajero intenta abrir esa pantalla con un enlace directo.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

#### Escenario 5: Proteger permisos del Administrador

```gherkin
Dado que el Administrador está editando los permisos del rol Administrador.
Cuando intenta desactivar el permiso "Gestionar permisos" o "Gestionar usuarios".
Entonces el sistema debe impedir el cambio.
Y debe mostrar el mensaje "No se puede retirar este permiso al rol Administrador".
```

#### Escenario 6: Salir sin guardar

```gherkin
Dado que el Administrador cambió permisos del rol Bodeguero sin guardar.
Cuando intenta salir de la pantalla.
Entonces el sistema debe preguntar "Tiene cambios sin guardar. ¿Desea salir?".
Y si confirma, no debe aplicar los cambios.
```

#### Escenario 7: Usuario sin permiso

```gherkin
Dado que un Gerente inició sesión.
Cuando intenta abrir la gestión de permisos.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---

## HU-57 · Iniciar sesión

| Actor | Requisitos vinculados |
| --- | --- |
| Todos los roles del sistema | RF-61 |

**Historia**

> Como usuario con cuenta (Administrador, Gerente, Veterinario, Técnico Veterinario, Recepcionista, Cajero, Bodeguero o Cliente), quiero iniciar sesión con mi correo y contraseña, para acceder de forma segura a las funciones de mis roles.

**Criterios de aceptación**

#### Escenario 1: Inicio de sesión exitoso

```gherkin
Dado que el Veterinario tiene una cuenta activa.
Cuando ingresa su correo y contraseña correctos y presiona "Iniciar sesión".
Entonces el sistema debe iniciar la sesión.
Y debe mostrar la pantalla principal con las funciones del rol Veterinario.
```

#### Escenario 2: Usuario con varios roles

```gherkin
Dado que "Jorge Solís" tiene los roles Gerente y Administrador.
Cuando inicia sesión correctamente.
Entonces el sistema debe mostrarle las funciones de ambos roles.
```

#### Escenario 3: Credenciales incorrectas

```gherkin
Dado que el usuario se encuentra en la pantalla de inicio de sesión.
Cuando ingresa una contraseña incorrecta o un correo no registrado.
Entonces el sistema debe negar el acceso.
Y debe mostrar el mensaje "Correo o contraseña incorrectos", sin indicar cuál de los dos falló.
```

#### Escenario 4: Campos vacíos

```gherkin
Dado que el usuario se encuentra en la pantalla de inicio de sesión.
Cuando presiona "Iniciar sesión" sin ingresar el correo o la contraseña.
Entonces el sistema no debe intentar el acceso.
Y debe mostrar el mensaje "Ingrese su correo y contraseña".
```

#### Escenario 5: Bloqueo por intentos fallidos

```gherkin
Dado que el usuario ha fallado 4 intentos consecutivos de inicio de sesión.
Cuando falla el quinto intento.
Entonces el sistema debe bloquear la cuenta durante 15 minutos.
Y debe mostrar el mensaje "Cuenta bloqueada temporalmente. Intente en 15 minutos".
```

#### Escenario 6: Intento durante el bloqueo

```gherkin
Dado que la cuenta está bloqueada desde hace 5 minutos.
Cuando el usuario ingresa la contraseña correcta.
Entonces el sistema debe negar el acceso.
Y debe mostrar el mensaje "Cuenta bloqueada temporalmente. Intente en 10 minutos".
```

#### Escenario 7: Reinicio del contador de intentos

```gherkin
Dado que el usuario falló 3 intentos.
Cuando inicia sesión correctamente en el cuarto.
Entonces el sistema debe reiniciar el contador de intentos fallidos a cero.
```

#### Escenario 8: Cuenta inactiva o dada de baja

```gherkin
Dado que la cuenta del usuario está inactiva o fue dada de baja.
Cuando ingresa su correo y contraseña correctos.
Entonces el sistema debe negar el acceso.
Y debe mostrar el mensaje "Su cuenta se encuentra desactivada. Contacte al administrador".
```

#### Escenario 9: Primer ingreso con contraseña temporal

```gherkin
Dado que el usuario tiene una contraseña temporal.
Cuando inicia sesión por primera vez.
Entonces el sistema debe llevarlo al cambio obligatorio de contraseña (HU-48).
```

---

## HU-58 · Recuperar contraseña

| Actor | Requisitos vinculados |
| --- | --- |
| Todos los roles del sistema | RF-62 |

**Historia**

> Como usuario con cuenta, quiero restablecer mi contraseña mediante un enlace enviado a mi correo, para recuperar el acceso si la olvido.

**Criterios de aceptación**

#### Escenario 1: Solicitud de recuperación

```gherkin
Dado que el Cajero tiene una cuenta activa con el correo "ana@correo.com".
Cuando presiona "¿Olvidó su contraseña?" e ingresa ese correo.
Entonces el sistema debe enviar un enlace de recuperación válido por 30 minutos.
Y debe mostrar el mensaje "Si el correo está registrado, recibirá un enlace".
```

#### Escenario 2: Restablecimiento exitoso

```gherkin
Dado que el Cajero recibió el enlace hace menos de 30 minutos.
Cuando lo abre, ingresa una nueva contraseña válida, la confirma y presiona "Guardar".
Entonces el sistema debe actualizar la contraseña.
Y debe mostrar el mensaje "Contraseña actualizada. Inicie sesión con su nueva contraseña".
```

#### Escenario 3: Enlace vencido

```gherkin
Dado que el enlace de recuperación fue enviado hace más de 30 minutos.
Cuando el usuario lo abre.
Entonces el sistema no debe permitir el cambio.
Y debe mostrar el mensaje "El enlace ha expirado. Solicite uno nuevo".
```

#### Escenario 4: Enlace ya usado o reemplazado

```gherkin
Dado que el usuario ya cambió su contraseña con un enlace, o solicitó uno más nuevo.
Cuando abre ese enlace anterior.
Entonces el sistema no debe permitir el cambio.
Y debe mostrar el mensaje "El enlace no es válido. Solicite uno nuevo".
```

#### Escenario 5: Contraseña que no cumple las reglas

```gherkin
Dado que el usuario abrió un enlace válido.
Cuando ingresa la nueva contraseña "abc123".
Entonces el sistema debe rechazarla.
Y debe mostrar el mensaje "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número".
```

#### Escenario 6: Confirmación distinta

```gherkin
Dado que el usuario abrió un enlace válido.
Cuando la confirmación no coincide con la nueva contraseña.
Entonces el sistema debe rechazar el cambio.
Y debe mostrar el mensaje "Las contraseñas no coinciden".
```

#### Escenario 7: Correo no registrado o cuenta inactiva

```gherkin
Dado que el correo "otro@correo.com" no pertenece a ninguna cuenta activa.
Cuando el usuario solicita recuperar la contraseña con ese correo.
Entonces el sistema no debe enviar ningún enlace.
Y debe mostrar el mismo mensaje "Si el correo está registrado, recibirá un enlace", sin indicar si la cuenta existe.
```

#### Escenario 8: Límite de solicitudes de recuperación

```gherkin
Dado que el Cajero ya solicitó 3 enlaces de recuperación con el correo "ana@correo.com" en los últimos 15 minutos.
Cuando solicita un cuarto enlace con ese correo.
Entonces el sistema no debe generar ni enviar un nuevo enlace.
Y debe mostrar el mismo mensaje "Si el correo está registrado, recibirá un enlace".
Y podrá solicitar un nuevo enlace cuando hayan pasado 15 minutos desde la primera solicitud.
```

---

## HU-59 · Cambiar contraseña

| Actor | Requisitos vinculados |
| --- | --- |
| Todos los roles del sistema | RF-63 |

**Historia**

> Como usuario registrado, quiero cambiar mi contraseña ingresando la actual y la nueva, para mantener segura mi cuenta.

**Criterios de aceptación**

#### Escenario 1: Cambio exitoso

```gherkin
Dado que el usuario tiene una sesión activa.
Cuando ingresa su contraseña actual correcta, una nueva contraseña válida y su confirmación, y presiona "Guardar".
Entonces el sistema debe actualizar la contraseña.
Y debe mostrar el mensaje "Contraseña actualizada correctamente".
```

#### Escenario 2: Contraseña actual incorrecta

```gherkin
Dado que el usuario se encuentra en el formulario de cambio de contraseña.
Cuando ingresa una contraseña actual incorrecta.
Entonces el sistema debe rechazar el cambio.
Y debe mostrar el mensaje "La contraseña actual no es correcta".
```

#### Escenario 3: Nueva contraseña que no cumple las reglas

```gherkin
Dado que el usuario se encuentra en el formulario de cambio de contraseña.
Cuando ingresa como nueva contraseña "clave1".
Entonces el sistema debe rechazar el cambio.
Y debe mostrar el mensaje "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número".
```

#### Escenario 4: Confirmación distinta

```gherkin
Dado que el usuario se encuentra en el formulario de cambio de contraseña.
Cuando la confirmación no coincide con la nueva contraseña.
Entonces el sistema debe rechazar el cambio.
Y debe mostrar el mensaje "Las contraseñas no coinciden".
```

#### Escenario 5: Nueva contraseña igual a la actual

```gherkin
Dado que el usuario se encuentra en el formulario de cambio de contraseña.
Cuando ingresa como nueva la misma contraseña que tiene ahora.
Entonces el sistema debe rechazar el cambio.
Y debe mostrar el mensaje "La nueva contraseña debe ser diferente a la actual".
```

#### Escenario 6: Cambio obligatorio en el primer ingreso

```gherkin
Dado que un Veterinario inicia sesión por primera vez con su contraseña temporal.
Cuando el sistema valida sus credenciales.
Entonces debe mostrar el formulario de cambio de contraseña antes de permitir el acceso a otras pantallas.
```

#### Escenario 7: Intentar saltar el cambio obligatorio

```gherkin
Dado que el Veterinario aún no cambia su contraseña temporal.
Cuando intenta abrir otra pantalla del sistema.
Entonces el sistema debe regresarlo al formulario de cambio de contraseña.
```

---

## HU-60 · Consultar y exportar auditoría del sistema

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-64 |

**Historia**

> Como Administrador, quiero consultar la auditoría del sistema, filtrarla por usuario, rol, acción, módulo y rango de fechas, y exportar el resultado a Excel (xlsx), para investigar quién realizó un cambio y cuándo, y respaldarlo ante una revisión.

**Criterios de aceptación**

#### Escenario 1: Filtrar por usuario y fechas

```gherkin
Dado que la Recepcionista "María López" realizó 8 acciones entre el 01-10-2026 y el 15-10-2026.
Cuando el Administrador filtra por el usuario "María López" y ese rango de fechas.
Entonces el sistema debe mostrar las 8 acciones ordenadas de la más reciente a la más antigua.
Y cada registro debe mostrar fecha y hora, usuario, rol, acción, módulo y registro afectado.
```

#### Escenario 2: Filtrar por acción y módulo

```gherkin
Dado que el 05-10-2026 se inactivaron 2 cuentas en el módulo "Usuarios".
Cuando el Administrador filtra por la acción "Inactivar", el módulo "Usuarios" y esa fecha.
Entonces el sistema debe mostrar solo esos 2 registros.
```

#### Escenario 3: Consulta sin filtros

```gherkin
Dado que el Administrador ingresa a la consulta de auditoría.
Cuando no aplica ningún filtro.
Entonces el sistema debe mostrar todos los registros del más reciente al más antiguo, en páginas de 20.
```

#### Escenario 4: Búsqueda sin resultados

```gherkin
Dado que ningún Bodeguero realizó acciones el 20-10-2026.
Cuando el Administrador filtra por el rol "Bodeguero" y esa fecha.
Entonces el sistema debe mostrar el mensaje "No existen registros de auditoría para los filtros seleccionados".
```

#### Escenario 5: Rango de fechas inválido

```gherkin
Dado que el Administrador está en la consulta de auditoría.
Cuando selecciona como fecha inicial el 20-10-2026 y como fecha final el 10-10-2026.
Entonces el sistema no debe realizar la búsqueda.
Y debe mostrar el mensaje "La fecha inicial no puede ser posterior a la fecha final".
```

#### Escenario 6: Fecha futura

```gherkin
Dado que la fecha actual es 14-11-2026.
Cuando el Administrador selecciona como fecha final el 30-11-2026.
Entonces el sistema no debe realizar la búsqueda.
Y debe mostrar el mensaje "La fecha final no puede ser posterior a la fecha actual".
```

#### Escenario 7: Acciones de un usuario dado de baja

```gherkin
Dado que el Cajero "Luis Ríos" fue dado de baja después de registrar 5 acciones.
Cuando el Administrador filtra por el usuario "Luis Ríos".
Entonces el sistema debe mostrar sus 5 acciones.
Y debe indicar que el usuario está dado de baja.
```

#### Escenario 8: Registros de solo lectura

```gherkin
Dado que el Administrador está viendo los resultados de la auditoría.
Cuando revisa cualquier registro.
Entonces el sistema no debe ofrecer opciones para editar ni eliminar registros.
```

#### Escenario 9: Usuario sin permiso

```gherkin
Dado que un Veterinario inició sesión.
Cuando intenta abrir la consulta de auditoría.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

#### Escenario 10: Exportar los resultados filtrados

```gherkin
Dado que el Administrador filtró las 8 acciones de "María López" entre el 01-10-2026 y el 15-10-2026.
Cuando presiona "Exportar a Excel".
Entonces el sistema debe descargar un archivo xlsx con esas 8 acciones y las mismas columnas de la consulta.
Y el archivo debe indicar los filtros usados y la fecha y hora de generación.
```

#### Escenario 11: Exportar sin resultados

```gherkin
Dado que la consulta no tiene registros para los filtros seleccionados.
Cuando el Administrador intenta exportar.
Entonces el sistema no debe generar el archivo.
Y debe mostrar el mensaje "No hay registros para exportar".
```

#### Escenario 12: La exportación queda registrada

```gherkin
Dado que el Administrador exportó la auditoría.
Cuando consulta la auditoría del módulo "Auditoría".
Entonces debe aparecer un registro con la acción "Exportar", su usuario y la fecha y hora
```

---

## HU-61 · Dar de baja usuario

| Actor | Requisitos vinculados |
| --- | --- |
| Administrador | RF-65 |

**Historia**

> Como Administrador, quiero dar de baja de forma definitiva la cuenta de un usuario que ya no trabaja en la clínica, para que no pueda volver a acceder al sistema y se conserve todo lo que registró,

**Criterios de aceptación**

#### Escenario 1: Baja exitosa

```gherkin
Dado que el Veterinario "Luis Torres" tiene una cuenta activa.
Cuando el Administrador selecciona "Dar de baja", ingresa el motivo "Renuncia" y confirma la acción.
Entonces la cuenta debe quedar en estado "Dado de baja" con la fecha y el motivo.
Y debe mostrar el mensaje "Usuario dado de baja correctamente".
```

#### Escenario 2: Se conserva el historial

```gherkin
Dado que "Luis Torres" registró 120 atenciones clínicas antes de ser dado de baja.
Cuando un Veterinario consulta esas atenciones.
Entonces el sistema debe mostrarlas con el nombre de Luis Torres como responsable.
```

#### Escenario 3: Inicio de sesión con cuenta dada de baja

```gherkin
Dado que la cuenta de "Luis Torres" fue dada de baja.
Cuando Luis intenta iniciar sesión con sus credenciales.
Entonces el sistema debe negar el acceso.
Y debe mostrar el mensaje "Su cuenta se encuentra desactivada. Contacte al administrador".
```

#### Escenario 4: Usuario con sesión abierta

```gherkin
Dado que "Luis Torres" tiene una sesión abierta.
Cuando el Administrador da de baja su cuenta.
Entonces el sistema debe cerrar la sesión de Luis en su siguiente acción.
```

#### Escenario 5: Baja de una cuenta inactiva

```gherkin
Dado que la cuenta de "Luis Torres" está inactiva.
Cuando el Administrador la da de baja y confirma la acción.
Entonces la cuenta debe pasar a estado "Dado de baja".
```

#### Escenario 6: No se puede activar

```gherkin
Dado que la cuenta de "Luis Torres" fue dada de baja.
Cuando el Administrador abre su ficha.
Entonces el sistema no debe ofrecer las opciones "Activar", "Editar" ni "Asignar rol".
```

#### Escenario 7: Motivo obligatorio

```gherkin
Dado que el Administrador presionó "Dar de baja" sobre la cuenta de "Luis Torres".
Cuando intenta confirmar sin ingresar el motivo.
Entonces el sistema no debe dar de baja la cuenta.
Y debe mostrar el mensaje "Ingrese el motivo de la baja".
```

#### Escenario 8: Cancelar la baja

```gherkin
Dado que el Administrador presionó "Dar de baja" sobre la cuenta de "Luis Torres".
Cuando presiona "Cancelar" en el mensaje de confirmación.
Entonces la cuenta debe seguir en su estado anterior.
```

#### Escenario 9: Último Administrador activo

```gherkin
Dado que solo existe un Administrador activo.
Cuando se intenta dar de baja su cuenta.
Entonces el sistema debe impedir la acción.
Y debe mostrar el mensaje "Debe existir al menos un Administrador activo".
```

#### Escenario 10: Dar de baja la propia cuenta

```gherkin
Dado que el Administrador "Jorge Solís" inició sesión.
Cuando intenta dar de baja su propia cuenta.
Entonces el sistema debe impedir la acción.
Y debe mostrar el mensaje "No puede dar de baja su propia cuenta".
```

#### Escenario 11: La persona también es Cliente

```gherkin
Dado que "Ana Ruiz" tiene los roles Cajero y Cliente.
Cuando el Administrador da de baja su cuenta del personal.
Entonces el sistema debe quitarle solo el rol Cajero.
Y Ana debe poder seguir ingresando como Cliente.
```

#### Escenario 12: Usuario sin permiso

```gherkin
Dado que un Gerente inició sesión.
Cuando intenta dar de baja la cuenta de otro usuario.
Entonces el sistema debe denegar el acceso.
Y debe mostrar el mensaje "No tiene permisos para realizar esta acción".
```

---
