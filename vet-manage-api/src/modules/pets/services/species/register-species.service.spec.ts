import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegisterSpeciesService } from './register-species.service.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';
import { ApiException } from '../../../../common/errors/api-exception.js';

const ACTOR_ID = 'user-1';
const tx = { name: 'tx' };

describe('RegisterSpeciesService', () => {
  let service: RegisterSpeciesService;
  const findByName = vi.fn();
  const findById = vi.fn();
  const create = vi.fn();
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)) };

  beforeEach(() => {
    vi.clearAllMocks();
    const repository = {
      findByName,
      findById,
      create,
    } as unknown as SpeciesRepository;

    service = new RegisterSpeciesService(repository, prisma as never, audit as never);
  });

  it('debe registrar exitosamente una especie con nombre y descripción', async () => {
    const mockCreated = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Canino',
      description: 'Perros domésticos y salvajes',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    findByName.mockResolvedValue(null);
    create.mockResolvedValue(mockCreated);

    const result = await service.execute({
      name: 'Canino',
      description: 'Perros domésticos y salvajes',
    }, ACTOR_ID);

    expect(findByName).toHaveBeenCalledWith('Canino');
    expect(create).toHaveBeenCalledWith({ name: 'Canino', description: 'Perros domésticos y salvajes' }, tx);
    expect(result).toEqual(mockCreated);
    expect(result.isActive).toBe(true);
  });

  it('debe registrar exitosamente una especie sin descripción (opcional)', async () => {
    const mockCreated = {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      name: 'Felino',
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    findByName.mockResolvedValue(null);
    create.mockResolvedValue(mockCreated);

    const result = await service.execute({
      name: 'Felino',
    }, ACTOR_ID);

    expect(create).toHaveBeenCalledWith({ name: 'Felino', description: undefined }, tx);
    expect(result.name).toBe('Felino');
    expect(result.description).toBeNull();
  });

  it('debe lanzar ApiException.badRequest cuando el nombre está vacío', async () => {
    await expect(
      service.execute({
        name: '   ',
      }, ACTOR_ID),
    ).rejects.toThrow(ApiException);

    await expect(
      service.execute({
        name: '   ',
      }, ACTOR_ID),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'El nombre de la especie es obligatorio',
    });
  });

  it('debe lanzar ApiException.conflict cuando ya existe una especie con ese nombre', async () => {
    const existing = {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      name: 'Canino',
      description: 'Existente',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    findByName.mockResolvedValue(existing);

    await expect(
      service.execute({
        name: 'Canino',
      }, ACTOR_ID),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe una especie registrada con el nombre "Canino"',
    });
  });

  describe('auditoría', () => {
    it('registra la acción en la misma transacción con el usuario autenticado como actor', async () => {
      findByName.mockResolvedValue(null);
      create.mockResolvedValue({ id: 's1', name: 'Canino', description: null, isActive: true });

      await service.execute({ name: 'Canino' }, ACTOR_ID);

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(tx, {
        actorId: ACTOR_ID,
        action: 'Registrar',
        module: 'Especies',
        affectedRecord: 'Canino',
      });
    });

    it('no registra nada cuando la especie ya existe', async () => {
      findByName.mockResolvedValue({ id: 's1', name: 'Canino' });

      await expect(service.execute({ name: 'Canino' }, ACTOR_ID)).rejects.toBeInstanceOf(ApiException);

      expect(create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('falla el registro si no se puede guardar la auditoría', async () => {
      findByName.mockResolvedValue(null);
      create.mockResolvedValue({ id: 's1', name: 'Canino', description: null, isActive: true });
      audit.record.mockRejectedValue(new Error('fallo de auditoría'));

      await expect(service.execute({ name: 'Canino' }, ACTOR_ID)).rejects.toThrow('fallo de auditoría');
    });
  });
});
