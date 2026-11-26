# Historia de Usuario: HU-12

| Campo | Valor |
| :--- | :--- |
| **Número** | HU-12 |
| **Actor** | Recepcionista, Gerente, Veterinario, Técnico Veterinario |
| **Nombre historia** | Consultar datos del paciente |
| **Requerimientos vinculados** | RF-08 |
| **Módulo Responsable** | Módulo 1 (Historial Clínico). Estandarizar la paginación 20 |

---

## Descripción

**Como** Recepcionista, Gerente, Veterinario o Técnico Veterinario, **quiero** consultar los datos de un paciente por nombre, código identificador, primer nombre o número de cédula del cliente asociado, **para** localizar su ficha y consultar su información durante la gestión y la atención veterinaria.

---

## Criterios de aceptación (Formato Gherkin)

### Escenario 1: Consulta por nombre del paciente
*   **Dado que** la Recepcionista, Gerente, Veterinario o Técnico Veterinario se encuentra en el buscador y existen pacientes registrados.
*   **Cuando** ingresa el nombre completo o parcial de un paciente y presiona "Buscar".
*   **Entonces** el sistema debe mostrar los pacientes cuyos nombres coincidan total o parcialmente con el criterio.
*   **Y** debe permitir seleccionar un paciente para consultar su ficha.

### Escenario 2: Consulta por código identificador del paciente
*   **Dado que** existe un paciente registrado con el código identificador "PAC-0001", generado por el sistema.
*   **Cuando** el Recepcionista, Gerente, Veterinario o Técnico Veterinario ingresa "PAC-0001" en el buscador y presiona "Buscar".
*   **Entonces** el sistema debe mostrar el paciente cuyo código coincida exactamente con el ingresado.
*   **Y** debe permitir seleccionar el registro correspondiente para consultar su ficha.

### Escenario 3: Consulta por primer nombre del cliente
*   **Dado que** existen clientes registrados con pacientes asociados.
*   **Cuando** el Recepcionista, Gerente, Veterinario o Técnico Veterinario ingresa al menos 3 caracteres del primer nombre de un cliente y presiona "Buscar".
*   **Entonces** el sistema debe mostrar los pacientes asociados a clientes cuyos primeros nombres coincidan total o parcialmente con el criterio.
*   **Y** debe permitir seleccionar un paciente para consultar su ficha.

### Escenario 4: Consulta por número de cédula del cliente
*   **Dado que** existe un cliente registrado con uno o más pacientes asociados.
*   **Cuando** el Recepcionista, Gerente, Veterinario o Técnico Veterinario ingresa entre 5 y 10 dígitos de la cédula del cliente y presiona "Buscar".
*   **Entonces** el sistema debe mostrar los pacientes asociados a clientes cuya cédula comience con los dígitos ingresados.
*   **Y** debe permitir consultar la ficha del paciente seleccionado.

### Escenario 5: Consulta ignorando espacios, tildes y mayúsculas
*   **Dado que** existe un paciente registrado con el nombre "José".
*   **Cuando** el Recepcionista, Gerente, Veterinario o Técnico Veterinario ingresa " JOSE " o "jos" y presiona "Buscar".
*   **Entonces** el sistema debe encontrar al paciente "José", ignorando los espacios exteriores y las diferencias entre mayúsculas, minúsculas y tildes.
*   **Y** debe mostrar al paciente entre los resultados disponibles.

### Escenario 6: Consulta sin resultados
*   **Dado que** el Recepcionista, Gerente, Veterinario o Técnico Veterinario se encuentra en el apartado de consulta de pacientes.
*   **Cuando** ingresa un criterio que no coincide con ningún paciente o cliente asociado y presiona "Buscar".
*   **Entonces** el sistema no debe mostrar resultados.
*   **Y** debe presentar el mensaje "No se encontraron pacientes que coincidan con la búsqueda".

### Escenario 7: Consulta con criterio vacío
*   **Dado que** el Recepcionista, Gerente, Veterinario o Técnico Veterinario se encuentra en el apartado de consulta de pacientes.
*   **Cuando** presiona "Buscar" sin ingresar ningún criterio.
*   **Entonces** el sistema no debe ejecutar la consulta.

### Escenario 8: Visualización del estado del paciente en los resultados
*   **Dado que** existen pacientes con estado "Activo", "Inactivo" y "Dado de baja" que coinciden con el criterio.
*   **Cuando** el Recepcionista, Gerente, Veterinario o Técnico Veterinario ejecuta la consulta.
*   **Entonces** el sistema debe incluir en los resultados a los pacientes de cualquier estado.
*   **Y** debe mostrar el estado de cada paciente junto con su código, nombre, especie y cliente asociado.
