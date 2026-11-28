# Diseño técnico - HU-005

## Arquitectura

Se implementará un submódulo appointments dentro
del módulo scheduling del backend NestJS.

Se respetará la separación existente entre:
- Controladores.
- Servicios.
- Repositorios.
- DTOs.
- Pruebas automatizadas.

## Endpoint propuesto

PATCH /api/v1/scheduling/appointments/:id/cancel

El cuerpo de la solicitud contendrá el motivo
de cancelación.

El responsable se obtendrá del usuario autenticado.

## Reglas de negocio

1. La cita debe existir.
2. Su estado debe ser PROGRAMADA.
3. No debe tener pagos aprobados.
4. Deben faltar al menos 24 horas para la cita.
5. El motivo no puede estar vacío ni contener
   únicamente espacios.

## Persistencia

Dentro de una transacción:

- Actualizar Cita a CANCELADA.
- Establecer tipoCancelacion como ORDINARIA.
- Crear CambioEstadoCita con motivo, fecha y actor.
- Crear NotificacionCita de tipo CANCELACION
  con estado PENDIENTE.

No eliminar físicamente la cita ni sus pagos.

## Disponibilidad

Verificar que las citas canceladas no ocupen
recursos en las consultas de disponibilidad.

## Seguridad

Permiso propuesto: appointments:cancel.

El backend validará la autorización y todas
las reglas de negocio.

## Concurrencia

Evitar cancelaciones duplicadas y coordinar
la cancelación con la aprobación de pagos.

## Frontend

- Selección de cita.
- Modal de confirmación.
- Campo obligatorio de motivo.
- Mensajes de error y éxito.
- Actualización del estado mostrado.

## Estrategia de pruebas

- Pruebas unitarias de reglas de negocio.
- Pruebas de integración con PostgreSQL.
- Pruebas de autorización.
- Pruebas de componentes frontend.
- Pruebas de extremo a extremo.
- Pruebas de regresión.

Se utilizarán fechas controladas para verificar
el límite exacto de 24 horas.

## Línea base

Fecha: 26/11/2026.
Archivos aprobados: 92 de 92.
Pruebas aprobadas: 890 de 890.
Pruebas fallidas: 0.
Duración: 11.91 segundos.
