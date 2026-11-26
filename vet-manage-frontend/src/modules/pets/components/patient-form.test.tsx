import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { PatientForm } from './patient-form';

const species = [
  { id: 'sp-1', name: 'Canino' },
  { id: 'sp-2', name: 'Felino' },
];
const breedsBySpecies: Record<string, { id: string; name: string }[]> = {
  'sp-1': [{ id: 'br-1', name: 'Labrador' }],
  'sp-2': [{ id: 'br-2', name: 'Siamés' }],
};
const client = { id: 'cl-1', identification: '1710034065', firstName: 'María', lastName: 'López' };

function setup(onSubmit = vi.fn(async () => undefined)) {
  const loadBreeds = vi.fn(async (speciesId: string) => breedsBySpecies[speciesId] ?? []);
  const searchClients = vi.fn(async () => [client]);
  render(
    <PatientForm species={species} loadBreeds={loadBreeds} searchClients={searchClients} onSubmit={onSubmit} onCancel={vi.fn()} />,
  );
  return { onSubmit, loadBreeds, searchClients };
}

async function fillValidPatient() {
  await userEvent.type(screen.getByLabelText(/^nombre/i), 'Firulais');
  await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
  await screen.findByRole('option', { name: 'Labrador' });
  await userEvent.selectOptions(screen.getByLabelText(/raza/i), 'br-1');
  await userEvent.selectOptions(screen.getByLabelText(/sexo/i), 'MALE');
  await userEvent.type(screen.getByLabelText(/fecha de nacimiento/i), '10052024');
  await userEvent.type(screen.getByLabelText(/peso/i), '12.5');
  await userEvent.type(screen.getByLabelText(/talla/i), '45');
  await userEvent.selectOptions(screen.getByLabelText(/estado reproductivo/i), 'STERILIZED');
}

async function chooseClient() {
  await userEvent.type(screen.getByLabelText(/cliente/i), 'María');
  await userEvent.click(await screen.findByRole('button', { name: /maría lópez/i }));
}

describe('PatientForm', () => {
  it('no tiene ningún campo para el código identificador', () => {
    setup();

    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
  });

  it('impide guardar con campos vacíos y los resalta', async () => {
    const { onSubmit } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Por favor, complete todos los campos obligatorios');
    expect(screen.getByLabelText(/^nombre/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exige seleccionar un cliente', async () => {
    const { onSubmit } = setup();
    await fillValidPatient();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Debe seleccionar un cliente registrado');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('carga las razas de la especie elegida y limpia la raza al cambiarla', async () => {
    const { loadBreeds } = setup();

    await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
    await screen.findByRole('option', { name: 'Labrador' });
    await userEvent.selectOptions(screen.getByLabelText(/raza/i), 'br-1');
    await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-2');

    await screen.findByRole('option', { name: 'Siamés' });
    expect(loadBreeds).toHaveBeenLastCalledWith('sp-2');
    expect(screen.getByLabelText(/raza/i)).toHaveValue('');
    expect(screen.queryByRole('option', { name: 'Labrador' })).not.toBeInTheDocument();
  });

  it('envía el borrador completo con el cliente elegido', async () => {
    const { onSubmit } = setup();
    await fillValidPatient();
    await chooseClient();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Firulais',
      speciesId: 'sp-1',
      breedId: 'br-1',
      gender: 'MALE',
      birthDate: '10-05-2024',
      weightKg: 12.5,
      heightCm: 45,
      reproductiveStatus: 'STERILIZED',
      color: undefined,
      clientId: 'cl-1',
    });
  });

  it('resalta los campos que rechaza el backend', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError('El cliente seleccionado no está disponible', 409, { errors: ['clientId'] });
    });
    setup(onSubmit);
    await fillValidPatient();
    await chooseClient();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El cliente seleccionado no está disponible');
    });
  });
});
