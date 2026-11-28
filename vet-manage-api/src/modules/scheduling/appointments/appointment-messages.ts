export const APPOINTMENT_MESSAGES = {
  patientDoesNotBelong: 'El paciente no pertenece al cliente',
  mustBeFuture: 'La fecha y hora deben ser posteriores al momento actual',
  invalidDuration:
    'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
  blocked: 'Horario bloqueado',
  veterinarianUnavailable: 'Veterinario no disponible',
  // Se distingue de una cita ocupada para que la recepción sepa que debe revisar la jornada.
  outsideWorkingHours: 'Veterinario no disponible: el horario está fuera de su jornada de atención en esta sucursal',
  roomUnavailable: 'Consultorio no disponible',
  notOnSlot: 'La hora debe ser en punto o media hora',
} as const;
