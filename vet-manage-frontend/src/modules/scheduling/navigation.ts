// El menú y las rutas de la agenda se generan desde esta lista; cada sección exige su permiso.
export type SchedulingPath =
  | 'resources'
  | 'work-schedules'
  | 'saturday-shifts'
  | 'my-availability'
  | 'blocks'
  | 'rates';

export type SchedulingSection = {
  label: string;
  path: SchedulingPath;
  permission: string;
  description: string;
};

export const SCHEDULING_SECTIONS: SchedulingSection[] = [
  {
    label: 'Recursos disponibles',
    path: 'resources',
    permission: 'resources:read-availability',
    description: 'Consulta veterinarios y consultorios libres por sucursal e intervalo.',
  },
  {
    label: 'Horarios base',
    path: 'work-schedules',
    permission: 'work-schedules:read',
    description: 'Jornada autorizada de cada veterinario por sucursal y día.',
  },
  {
    label: 'Turnos de sábado',
    path: 'saturday-shifts',
    permission: 'saturday-shifts:read',
    description: 'Un único veterinario por sucursal y sábado, con sustitución justificada.',
  },
  {
    label: 'Mi disponibilidad',
    path: 'my-availability',
    permission: 'daily-availability:manage-own',
    description: 'Franjas que habilitas para una fecha dentro de tu jornada.',
  },
  {
    label: 'Bloqueos',
    path: 'blocks',
    permission: 'schedule-blocks:read',
    description: 'Bloqueos de horario de un veterinario o de toda la sucursal.',
  },
  {
    label: 'Tarifas',
    path: 'rates',
    permission: 'rates:read',
    description: 'Tarifas por servicio y sucursal con historial de precios.',
  },
];
