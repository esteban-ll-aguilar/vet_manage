# HU-005 - Cancelar una cita sin pagos aprobados

## Contexto

Modulo: Agendamiento de Citas.
Actor: Recepcionista.
Prioridad: Must Have.

## Historia de usuario

Como recepcionista, quiero cancelar una cita sin pagos
aprobados indicando un motivo, para liberar sus recursos
y conservar evidencia de la cancelacion.

## Requisitos relacionados

- RF-AC-011
- RF-AC-012
- RF-AC-031
- RF-AC-040

## Alcance

- Consultar y seleccionar la cita que se desea cancelar.
- Validar que la cita se encuentre en estado PROGRAMADA.
- Validar que no existan pagos aprobados.
- Exigir al menos 24 horas de anticipacion.
- Solicitar un motivo obligatorio de cancelacion.
- Cambiar el estado de la cita a CANCELADA.
- Registrar el motivo, responsable y fecha de cancelacion.
- Liberar los recursos asociados a la cita.
- Generar el registro de notificacion de cancelacion.
- Implementar controles de acceso.
- Validar los casos de prueba CP-005-01 a CP-005-09.

## Fuera del alcance

- Envio efectivo del correo de cancelacion (HU-020).
- Implementacion completa de reembolsos.
- Autorizacion excepcional de cancelaciones pagadas.

## Dependencias

- Modelos de agendamiento existentes en Prisma.
- Sistema de autenticacion y autorizacion RBAC.
- HU-006: Consultar recursos disponibles.
- Integracion con el registro y consulta de citas.
- Integracion con la aprobacion de pagos.

## Impacto

Backend NestJS, frontend React, permisos de acceso
y pruebas automatizadas.

Se reutilizaran los modelos existentes sin introducir
nuevas tablas inicialmente.
