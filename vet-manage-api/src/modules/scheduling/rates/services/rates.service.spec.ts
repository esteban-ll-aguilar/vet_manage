import { describe, expect, it, vi } from 'vitest';
import { INACTIVE_SERVICE_RATE_MESSAGE, RatesService } from './rates.service.js';

function build() {
  const repository = {
    findService: vi.fn(),
    findServices: vi.fn(),
    findBranch: vi.fn(),
    findMany: vi.fn(),
    findActive: vi.fn(),
    upsert: vi.fn(),
    deactivateService: vi.fn(),
    activateService: vi.fn(),
  };
  return { service: new RatesService(repository as never), repository };
}

describe('RatesService', () => {
  it('lista todos los servicios para permitir ver y reactivar los inactivos', async () => {
    const ctx = build();
    ctx.repository.findServices.mockResolvedValue([
      { id: 's1', nombre: 'Consulta general', estado: true },
      { id: 's2', nombre: 'Vacunación', estado: false },
    ]);

    await expect(ctx.service.listServices()).resolves.toHaveLength(2);
    expect(ctx.repository.findServices).toHaveBeenCalledOnce();
  });

  it('CP-025-01 obtiene la tarifa activa vigente de USD 20.00', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.findActive.mockResolvedValue({
      id: 'r1',
      servicioId: 's1',
      sucursalId: 'b1',
      importe: 20,
      estado: true,
    });

    await expect(ctx.service.getActiveRate('s1', 'b1'))
      .resolves.toMatchObject({ id: 'r1', importe: 20, estado: true });
  });

  it('CP-025-01 crea una cotización con el importeReserva vigente', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.findActive.mockResolvedValue({ id: 'r1', importe: 20, estado: true });

    await expect(ctx.service.getReservationQuote('s1', 'b1'))
      .resolves.toEqual({ servicioId: 's1', sucursalId: 'b1', importeReserva: 20 });
  });

  it('CP-025-01 registra una tarifa por servicio y sucursal', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.findBranch.mockResolvedValue({ id: 'b1', nombre: 'Loja', estado: true });
    ctx.repository.upsert.mockResolvedValue({ id: 'r1', importe: 20 });

    await expect(ctx.service.save({ servicioId: 's1', sucursalId: 'b1', importe: 20 }))
      .resolves.toEqual({ id: 'r1', importe: 20 });
    expect(ctx.repository.upsert).toHaveBeenCalledWith('s1', 'b1', 20);
  });

  it('permite asignar una tarifa a un servicio inactivo sin habilitar reservas', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: false });
    ctx.repository.findBranch.mockResolvedValue({ id: 'b1', nombre: 'Loja', estado: true });
    ctx.repository.upsert.mockResolvedValue({ id: 'r1', importe: 20 });

    await expect(ctx.service.save({ servicioId: 's1', sucursalId: 'b1', importe: 20 }))
      .resolves.toEqual({ id: 'r1', importe: 20 });
    await expect(ctx.service.assertActiveForReservation('s1', 'b1'))
      .rejects.toThrow(INACTIVE_SERVICE_RATE_MESSAGE);
  });

  it('CP-025-02 crea una tarifa nueva y conserva la anterior en historial', async () => {
    const ctx = build();
    const previousRate = { id: 'r1', importe: 20, estado: true };
    ctx.repository.findMany.mockResolvedValue([
      { ...previousRate, servicioId: 's1', sucursalId: 'b1', servicio: { estado: true } },
    ]);
    ctx.repository.upsert.mockResolvedValue({ id: 'r2', importe: 25, estado: true });

    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.findActive.mockResolvedValueOnce(previousRate);
    const previousQuote = await ctx.service.getReservationQuote('s1', 'b1');

    await expect(ctx.service.update('r1', { importe: 25 }))
      .resolves.toMatchObject({ id: 'r2', importe: 25 });
    expect(ctx.repository.upsert).toHaveBeenCalledWith('s1', 'b1', 25);

    ctx.repository.findActive.mockResolvedValueOnce({ id: 'r2', importe: 25, estado: true });
    await expect(ctx.service.getReservationQuote('s1', 'b1'))
      .resolves.toEqual({ servicioId: 's1', sucursalId: 'b1', importeReserva: 25 });
    expect(previousQuote.importeReserva).toBe(20);
  });

  it('permite actualizar la tarifa de un servicio inactivo', async () => {
    const ctx = build();
    ctx.repository.findMany.mockResolvedValue([
      {
        id: 'r1',
        servicioId: 's1',
        sucursalId: 'b1',
        servicio: { estado: false },
      },
    ]);
    ctx.repository.upsert.mockResolvedValue({ id: 'r2', importe: 25 });

    await expect(ctx.service.update('r1', { importe: 25 }))
      .resolves.toEqual({ id: 'r2', importe: 25 });
    expect(ctx.repository.upsert).toHaveBeenCalledWith('s1', 'b1', 25);
  });

  it('CP-025-03 rechaza reserva si el servicio está inactivo', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: false });

    await expect(ctx.service.assertActiveForReservation('s1', 'b1'))
      .rejects.toThrow(INACTIVE_SERVICE_RATE_MESSAGE);
  });

  it('CP-025-03 rechaza reserva si no existe tarifa activa', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.findActive.mockResolvedValue(null);

    await expect(ctx.service.assertActiveForReservation('s1', 'b1'))
      .rejects.toThrow(INACTIVE_SERVICE_RATE_MESSAGE);
  });

  it('CP-025-03 inactiva el servicio sin eliminar sus citas o tarifas históricas', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: true });
    ctx.repository.deactivateService.mockResolvedValue({ id: 's1', estado: false });

    await expect(ctx.service.deactivateService('s1')).resolves.toEqual({ id: 's1', estado: false });
    expect(ctx.repository.deactivateService).toHaveBeenCalledWith('s1');
  });

  it('CP-025-03 activa un servicio previamente inactivo', async () => {
    const ctx = build();
    ctx.repository.findService.mockResolvedValue({ id: 's1', nombre: 'Consulta general', estado: false });
    ctx.repository.activateService.mockResolvedValue({ id: 's1', estado: true });

    await expect(ctx.service.activateService('s1')).resolves.toEqual({ id: 's1', estado: true });
    expect(ctx.repository.activateService).toHaveBeenCalledWith('s1');
  });
});
