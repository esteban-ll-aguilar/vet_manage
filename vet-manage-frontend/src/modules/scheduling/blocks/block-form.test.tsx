import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Branch } from '../types';
import { BlockForm } from './block-form';
import type { ScheduleBlockDraft } from './types';

const branches: Branch[] = [{ id: 's-1', nombre: 'Loja', salas: [] }, { id: 's-2', nombre: 'Vilcabamba', salas: [] }];
const veterinarians = [{ id: 'v-1', nombre: 'Valentina Ruiz' }];

function setup(onSubmit = vi.fn<(draft: ScheduleBlockDraft) => Promise<void>>(async () => undefined)) {
  render(<BlockForm branches={branches} veterinarians={veterinarians} onSubmit={onSubmit} />);
  return onSubmit;
}

type Values = { scope?: 'vet' | 'branch'; vet?: boolean; start?: string; end?: string; motivo?: string };

async function fill({ scope = 'vet', vet = true, start = '09:00', end = '10:00', motivo = 'Permiso médico' }: Values = {}) {
  await userEvent.selectOptions(screen.getByLabelText(/^sucursal/i), 's-1');
  if (scope === 'branch') await userEvent.click(screen.getByLabelText(/toda la sucursal/i));
  if (scope === 'vet' && vet) await userEvent.selectOptions(screen.getByLabelText(/^veterinario/i), 'v-1');
  fireEvent.change(screen.getByLabelText(/^fecha/i), { target: { value: '2026-11-03' } });
  await userEvent.selectOptions(screen.getByLabelText(/hora de inicio/i), start);
  await userEvent.selectOptions(screen.getByLabelText(/hora de fin/i), end);
  if (motivo) await userEvent.type(screen.getByLabelText(/motivo/i), motivo);
  await userEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));
}

describe('BlockForm', () => {
  it('registra el bloqueo de un veterinario', async () => {
    const onSubmit = setup();
    await fill();

    expect(onSubmit).toHaveBeenCalledWith({
      sucursalId: 's-1', alcance: 'VETERINARIO', veterinarioId: 'v-1',
      fecha: '2026-11-03', horaInicio: '09:00', horaFin: '10:00', motivo: 'Permiso médico',
    });
  });

  it('registra un bloqueo de toda la sucursal sin pedir veterinario', async () => {
    const onSubmit = setup();
    await fill({ scope: 'branch', start: '12:00', end: '13:00', motivo: 'Mantenimiento' });

    expect(screen.queryByLabelText(/^veterinario/i)).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith({
      sucursalId: 's-1', alcance: 'SUCURSAL', fecha: '2026-11-03', horaInicio: '12:00', horaFin: '13:00', motivo: 'Mantenimiento',
    });
  });

  it.each([
    ['sin motivo', { motivo: '' }, 'Ingrese el motivo del bloqueo'],
    ['con la misma hora de inicio y fin', { end: '09:00' }, 'La hora de fin debe ser posterior a la hora de inicio'],
    ['sin veterinario', { vet: false }, 'Seleccione el veterinario'],
  ])('no envía un bloqueo %s y muestra el mensaje', async (_name, values: Values, message) => {
    const onSubmit = setup();
    await fill(values);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('si el bloqueo afecta una cita muestra sus datos para ubicarla', async () => {
    setup(vi.fn(async () => {
      throw Object.assign(new Error('El bloqueo afecta una cita existente'), {
        errors: ['Cita N.° 12 · 03/11/2026 09:30–10:00 · Paciente Luna · Valentina Ruiz · Consultorio 1'],
      });
    }));
    await fill();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('El bloqueo afecta una cita existente');
    expect(alert).toHaveTextContent('Cita N.° 12 · 03/11/2026 09:30–10:00 · Paciente Luna');
  });

  it('muestra el aviso de falta de permisos que devuelve la API', async () => {
    setup(vi.fn(async () => { throw Object.assign(new Error('No tiene permisos para realizar esta acción'), { errors: [] }); }));
    await fill();

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
  });

  it('ubica junto al campo los errores de validación de la API', async () => {
    setup(vi.fn(async () => {
      throw Object.assign(new Error('La hora de fin debe ser en punto o y media'), { errors: ['La hora de fin debe ser en punto o y media'] });
    }));
    await fill();

    expect(screen.getByText('La hora de fin debe ser en punto o y media')).toHaveClass('field-error');
  });
});
