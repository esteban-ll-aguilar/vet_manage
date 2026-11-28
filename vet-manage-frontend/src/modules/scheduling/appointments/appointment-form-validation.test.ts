import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_MESSAGES,
  APPOINTMENT_REQUIRED_FIELDS,
  validateAppointmentForm,
  type AppointmentFormValues,
} from './appointment-form-validation';

const emptyValues: AppointmentFormValues = {
  sucursalId: '',
  clienteId: '',
  pacienteId: '',
  servicioId: '',
  veterinarioId: '',
  salaId: '',
  fecha: '',
  horaInicio: '',
  duracionMin: '',
};

describe('validación del formulario de citas', () => {
  it('señala todos los campos obligatorios faltantes', () => {
    const errors = validateAppointmentForm(emptyValues, 60);

    expect(Object.keys(errors).sort()).toEqual([...APPOINTMENT_REQUIRED_FIELDS].sort());
    expect(Object.values(errors)).toEqual(
      Array(APPOINTMENT_REQUIRED_FIELDS.length).fill(APPOINTMENT_MESSAGES.required),
    );
  });

  it('valida fecha futura y duración contra el máximo del servicio', () => {
    const values: AppointmentFormValues = {
      ...emptyValues,
      sucursalId: 'branch',
      clienteId: 'client',
      pacienteId: 'patient',
      servicioId: 'service',
      veterinarioId: 'vet',
      salaId: 'room',
      fecha: '2026-01-01',
      horaInicio: '09:00',
      duracionMin: '90',
    };

    expect(validateAppointmentForm(values, 60, new Date('2026-01-01T10:00:00-05:00'))).toMatchObject({
      fecha: APPOINTMENT_MESSAGES.future,
      horaInicio: APPOINTMENT_MESSAGES.future,
      duracionMin: APPOINTMENT_MESSAGES.duration,
    });
  });


  it('exige que la duración sea en períodos de 30 minutos', () => {
    const values: AppointmentFormValues = {
      ...emptyValues,
      sucursalId: 'branch',
      clienteId: 'client',
      pacienteId: 'patient',
      servicioId: 'service',
      veterinarioId: 'vet',
      salaId: 'room',
      fecha: '2030-01-02',
      horaInicio: '10:00',
      duracionMin: '45',
    };

    expect(validateAppointmentForm(values, 60, new Date('2026-01-01T10:00:00-05:00'))).toEqual({
      duracionMin: APPOINTMENT_MESSAGES.duration,
    });
  });
});
