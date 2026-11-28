import type { PermissionDefinition } from '../permissions.catalog.js';

const define = (entries: readonly [PermissionDefinition['key'], string][]): readonly PermissionDefinition[] => entries.map(([key, displayName]) => ({ key, displayName, description: `Permite: ${displayName.toLowerCase()}`, visible: true }));

export const SCHEDULING_PERMISSIONS = define([
  ['calendar:read', 'Consultar calendario y detalle de citas'],
  ['branches:read', 'Consultar sucursales, salas y servicios'],
  ['work-schedules:read', 'Consultar horarios base de atención'],
  ['work-schedules:manage', 'Definir horarios base de atención'],
  ['saturday-shifts:read', 'Consultar turnos de sábado'],
  ['saturday-shifts:manage', 'Asignar turnos de sábado'],
  ['daily-availability:read', 'Consultar disponibilidad diaria'],
  ['daily-availability:manage-own', 'Definir la disponibilidad diaria propia'],
  ['schedule-blocks:read', 'Consultar bloqueos de horario'],
  ['schedule-blocks:create', 'Registrar bloqueos de horario'],
  ['schedule-blocks:remove', 'Eliminar bloqueos de horario'],
  ['rates:read', 'Consultar tarifas'],
  ['rates:manage', 'Mantener el catálogo de tarifas'],
  ['resources:read-availability', 'Consultar recursos disponibles'],
  ['appointments:read', 'Consultar citas'],
  ['appointments:create', 'Registrar citas presenciales'],
  ['appointments:cancel', 'Cancelar citas sin pagos aprobados'],
  ['appointments:update', 'Modificar fecha, hora, veterinario o consultorio de una cita'],
]);
