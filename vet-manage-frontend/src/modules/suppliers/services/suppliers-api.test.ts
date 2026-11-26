import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import { suppliersApi } from './suppliers-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('suppliersApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('solicita una página con filtros codificados conforme al contrato del backend', async () => {
    vi.mocked(getJson).mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 11, totalPages: 2 });

    await suppliersApi.list({ page: 2, pageSize: 10, search: 'Vet & Cía', status: 'INACTIVE' });

    expect(getJson).toHaveBeenCalledWith('/suppliers?page=2&pageSize=10&search=Vet+%26+C%C3%ADa&status=INACTIVE');
  });

  it('consulta por UUID usando GET /suppliers/:id', async () => {
    vi.mocked(getJson).mockResolvedValue({ id: 'supplier-1' });

    await suppliersApi.get('supplier-1');

    expect(getJson).toHaveBeenCalledWith('/suppliers/supplier-1');
  });

  it('registra razón social y RUC como strings', async () => {
    const input = { businessName: 'Distribuidora Vet', ruc: '0012345678001' };
    vi.mocked(postJson).mockResolvedValue({ ...input, id: 'supplier-1' });

    await suppliersApi.create(input);

    expect(postJson).toHaveBeenCalledWith('/suppliers', input);
  });

  it('actualiza solo los campos permitidos con PATCH /suppliers/:id', async () => {
    const input = { businessName: 'Nombre nuevo', ruc: '0012345678001' };
    vi.mocked(patchJson).mockResolvedValue({ ...input, id: 'supplier-1' });

    await suppliersApi.update('supplier-1', input);

    expect(patchJson).toHaveBeenCalledWith('/suppliers/supplier-1', input);
  });
});
