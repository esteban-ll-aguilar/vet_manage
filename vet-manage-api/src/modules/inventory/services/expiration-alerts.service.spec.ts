import { describe, expect, it } from 'vitest';
import { findExpirationAlerts, type ExpirationLot } from './expiration-alerts.service.js';

const today = new Date('2026-11-19T12:00:00.000Z');

function lot(overrides: Partial<ExpirationLot> = {}): ExpirationLot {
  return {
    lotId: 'lot-001',
    productName: 'Vacuna antirrábica',
    lotCode: 'LOTE-001',
    expirationDate: '2026-12-19',
    availableQuantity: 10,
    ...overrides,
  };
}

describe('findExpirationAlerts', () => {
  it('includes all requested lot and product details when expiry is exactly 30 days away', () => {
    expect(findExpirationAlerts([lot()], today)).toEqual([{
      lotId: 'lot-001',
      productName: 'Vacuna antirrábica',
      lotCode: 'LOTE-001',
      expirationDate: '2026-12-19',
      availableQuantity: 10,
      status: 'UPCOMING',
      label: 'Próximo a caducar',
    }]);
  });

  it('labels a lot expiring today as upcoming', () => {
    expect(findExpirationAlerts([lot({ expirationDate: '2026-11-19', availableQuantity: 4 })], today)[0]?.label)
      .toBe('Próximo a caducar');
  });

  it('labels a lot that expired yesterday as expired', () => {
    expect(findExpirationAlerts([lot({ expirationDate: '2026-11-18', availableQuantity: 5 })], today)[0]?.label)
      .toBe('Caducado');
  });

  it('excludes lots that expire 31 days from today', () => {
    expect(findExpirationAlerts([lot({ expirationDate: '2026-12-20' })], today)).toEqual([]);
  });

  it('excludes lots with no available units', () => {
    expect(findExpirationAlerts([lot({ expirationDate: '2026-11-24', availableQuantity: 0 })], today)).toEqual([]);
  });

  it('removes an alert after the lot expiry changes beyond the 30-day window', () => {
    const original = lot({ availableQuantity: 8, expirationDate: '2026-11-29' });
    expect(findExpirationAlerts([original], today)).toHaveLength(1);

    const updated = { ...original, expirationDate: '2027-01-03' };
    expect(findExpirationAlerts([updated], today)).toEqual([]);
  });

  it('returns no alerts when no lots meet the conditions', () => {
    expect(findExpirationAlerts([
      lot({ lotCode: 'LOTE-031', expirationDate: '2026-12-20' }),
      lot({ lotCode: 'LOTE-EMPTY', expirationDate: '2026-11-24', availableQuantity: 0 }),
    ], today)).toEqual([]);
  });
});
