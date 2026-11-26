import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { CreateRateDto } from '../dtos/create-rate.dto.js';
import { UpdateRateDto } from '../dtos/update-rate.dto.js';
import { RateRepository } from '../repositories/rate.repository.js';

export const INACTIVE_SERVICE_RATE_MESSAGE = 'El servicio no tiene una tarifa activa';

@Injectable()
export class RatesService {
  constructor(private readonly rates: RateRepository) {}

  list(servicioId?: string, sucursalId?: string) {
    return this.rates.findMany(servicioId, sucursalId);
  }

  listServices() {
    return this.rates.findServices();
  }

  async save(dto: CreateRateDto) {
    const service = await this.rates.findService(dto.servicioId);
    if (!service) throw ApiException.badRequest(INACTIVE_SERVICE_RATE_MESSAGE);

    const branch = await this.rates.findBranch(dto.sucursalId);
    if (!branch || !branch.estado) throw ApiException.badRequest('La sucursal no está activa');

    return this.rates.upsert(dto.servicioId, dto.sucursalId, dto.importe);
  }

  async update(id: string, dto: UpdateRateDto) {
    const active = await this.rates.findMany();
    const existing = active.find((rate) => rate.id === id);
    if (!existing) throw ApiException.notFound('Tarifa no encontrada');
    return this.rates.upsert(existing.servicioId, existing.sucursalId, dto.importe);
  }

  async deactivateService(id: string) {
    const service = await this.rates.findService(id);
    if (!service) throw ApiException.notFound('Servicio no encontrado');
    return this.rates.deactivateService(id);
  }

  async activateService(id: string) {
    const service = await this.rates.findService(id);
    if (!service) throw ApiException.notFound('Servicio no encontrado');
    return this.rates.activateService(id);
  }

  async getActiveRate(servicioId: string, sucursalId: string) {
    const service = await this.rates.findService(servicioId);
    if (!service || !service.estado) throw ApiException.badRequest(INACTIVE_SERVICE_RATE_MESSAGE);

    return this.rates.findActive(servicioId, sucursalId);
  }

  async assertActiveForReservation(servicioId: string, sucursalId: string) {
    const active = await this.getActiveRate(servicioId, sucursalId);
    if (!active) throw ApiException.badRequest(INACTIVE_SERVICE_RATE_MESSAGE);
    return active;
  }

  async getReservationQuote(servicioId: string, sucursalId: string) {
    const active = await this.assertActiveForReservation(servicioId, sucursalId);
    return {
      servicioId,
      sucursalId,
      importeReserva: active.importe,
    };
  }
}
