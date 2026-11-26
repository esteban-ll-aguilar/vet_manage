export type ScheduleBlockScope = 'VETERINARIO' | 'SUCURSAL';

export type ScheduleBlock = {
  id: string;
  sucursal: { id: string; nombre: string };
  alcance: ScheduleBlockScope;
  veterinario: { id: string; nombre: string } | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
  registradoPor: string;
  creadoEn: string;
};

export type ScheduleBlockDraft = {
  sucursalId: string;
  alcance: ScheduleBlockScope;
  veterinarioId?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
};

export type Veterinarian = { id: string; nombre: string };
