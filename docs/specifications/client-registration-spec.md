# Especificación de Funcionalidad: Registro de Clientes

## 1. Introducción

Esta especificación detalla la funcionalidad de registro de clientes, incluyendo los requisitos, escenarios de uso y validaciones específicas para el campo dirección.

## 2. Requisitos Funcionales

### 2.1 RF-01: Registro de datos del cliente
El sistema debe permitir registrar los datos de un cliente con los siguientes campos:
- Cédula (10 dígitos numéricos)
- Primer nombre (máximo 100 caracteres)
- Primer apellido (máximo 100 caracteres)
- Teléfono (10 dígitos numéricos)
- Correo electrónico (formato válido)
- Dirección (opcional)

### 2.2 RF-02: Actualización de datos del cliente
El sistema debe permitir actualizar los datos del cliente, manteniendo inmutable la cédula.

### 2.3 RF-03: Dar de baja a un cliente
El sistema debe permitir dar de baja a un cliente, conservando su historial y evitando nuevas transacciones.

### 2.4 RF-04: Inactivar un cliente
El sistema debe permitir inactivar temporalmente a un cliente para evitar selección en nuevas transacciones.

### 2.5 RF-05: Activar un cliente
El sistema debe permitir activar temporalmente a un cliente para restaurar su disponibilidad.

### 2.6 RF-06: Consulta de clientes
El sistema debe permitir consultar clientes por cédula, nombre o apellido.

## 3. Validaciones Específicas

### 3.1 Validación de Cédula
- Debe tener exactamente 10 dígitos numéricos
- Debe validar el algoritmo de cédula ecuatoriana

### 3.2 Validación de Teléfono
- Debe tener exactamente 10 dígitos numéricos
- No debe contener caracteres alfabéticos

### 3.3 Validación de Correo Electrónico
- Debe seguir el formato usuario@dominio.com
- Debe validar la estructura del correo

### 3.4 Validación de Dirección
- Campo opcional
- No se aplica validación específica más allá de tamaño máximo

## 4. Integración con Sistema de Identidad

### 4.1 Registro de Usuarios
El registro de clientes se integra con el sistema de identidad mediante:
- Creación de una persona (person) con datos del cliente
- Validación de unicidad por cédula
- Uso de los mismos mecanismos de validación que para usuarios del personal

### 4.2 Reutilización de Patrones
- Se reutilizan patrones de validación definidos en el módulo de identidad
- Se aplican las mismas reglas de negocio para cédulas, correos y nombres
- Se mantienen los mensajes de error consistentes

## 5. Escenarios de Uso

### 5.1 Registro Exitoso de Cliente
```gherkin
Dado que el Recepcionista, Veterinario o Gerente se encuentra en el formulario de registro de cliente
Cuando ingresa los campos obligatorios (cédula de 10 dígitos numéricos, primer nombre, primer apellido, teléfono de 10 dígitos numéricos y correo con formato (usuario@dominio.com) y la dirección opcional, y presiona el botón "Guardar"
Entonces el sistema debe guardar el cliente en la base de datos con estado "Activo"
Y debe mostrar el mensaje "Cliente registrado exitosamente".
```

### 5.2 Omitir Campos Obligatorios
```gherkin
Dado que el Recepcionista, Veterinario o Gerente se encuentra en el formulario de registro de cliente
Cuando deja en blanco uno o más campos obligatorios(ej. contacto), se presiona el botón "Guardar"
Entonces el sistema debe detener el guardado del registro
Y debe resaltar los campos requeridos vacíos y mostrar el mensaje "Por favor, complete todos los campos obligatorios" .
```

### 5.3 Registro de Cédula Existente
```gherkin
Dado que existe un cliente registrado en el sistema con número de cédula
Cuando el Recepcionista, Gerente ingresa el mismo número de cédula junto a los demás datos requeridos, presiona el botón "Guardar"
Entonces el sistema debe rechazar la transacción
Y debe mostrar el mensaje "Número de cédula ya registrado".
```

### 5.4 Validación de Cédula Inválida
```gherkin
Dado que el Recepcionista se encuentra en el formulario de registro de cliente
Cuando ingresa un número de cédula que no cumple con el formato exacto de 10 dígitos numéricos (ej. alfanumérico o longitud diferente) y presiona el botón "Guardar"
Entonces el sistema debe rechazar la transacción
Y debe resaltar el campo cédula y mostrar el mensaje "Número de cédula no válido" .
```

### 5.5 Validación de Formato Incorrecto
```gherkin
Dado que el Recepcionista se encuentra en el formulario de registro de cliente
Cuando ingresa un correo electrónico sin formato válido((usuario@dominio.com) ) o un teléfono con caracteres alfabéticos, si no contiene exactamente 10 dígitos, o con prefijo inválido presiona el botón "Guardar"
Entonces el sistema debe bloquear el guardado del registro
Y debe resaltar los campos erróneos y mostrar el mensaje "Por favor, ingrese un correo y número de teléfono válido" .
```

## 6. Consideraciones Técnicas

### 6.1 Integración con Validación de Identificación
Se reutiliza la validación de cédula del módulo de identidad (`src/common/validation/identification.ts`).

### 6.2 Manejo de Errores
Los mensajes de error se mantienen consistentes con los definidos en el sistema de identidad.

### 6.3 Estado del Cliente
- Nuevo cliente: estado "Activo" por defecto
- Clientes inactivos: estado "Inactivo"
- Clientes dados de baja: estado "De baja"

## 7. Referencias
- HU-01: Registrar datos del cliente
- Módulo de Identidad y RBAC