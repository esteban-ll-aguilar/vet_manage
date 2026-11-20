const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const EXPIRATION_WARNING_DAYS = 30;

export type ExpirationLot = {
  lotId: string;
  productName: string;
  lotCode: string;
  expirationDate: Date | string;
  availableQuantity: number;
};

export type ExpirationAlertStatus = 'UPCOMING' | 'EXPIRED';

export type ExpirationAlert = {
  lotId: string;
  productName: string;
  lotCode: string;
  expirationDate: string;
  availableQuantity: number;
  status: ExpirationAlertStatus;
  label: 'Próximo a caducar' | 'Caducado';
};

/**
 * Evaluates the current lot data so a changed expiry date or quantity is
 * reflected immediately the next time the dashboard requests its alerts.
 * Date-only values are compared as UTC calendar days to avoid time-of-day
 * and browser/server timezone differences.
 */
export function findExpirationAlerts(lots: readonly ExpirationLot[], referenceDate = new Date()): ExpirationAlert[] {
  const today = toUtcDay(referenceDate);
  if (today === null) return [];

  const lastUpcomingDay = today + EXPIRATION_WARNING_DAYS * DAY_IN_MILLISECONDS;

  return lots
    .flatMap((lot): ExpirationAlert[] => {
      if (!Number.isFinite(lot.availableQuantity) || lot.availableQuantity <= 0) return [];

      const expirationDay = toUtcDay(lot.expirationDate);
      if (expirationDay === null || expirationDay > lastUpcomingDay) return [];

      const status: ExpirationAlertStatus = expirationDay < today ? 'EXPIRED' : 'UPCOMING';
      return [{
        lotId: lot.lotId,
        productName: lot.productName,
        lotCode: lot.lotCode,
        expirationDate: new Date(expirationDay).toISOString().slice(0, 10),
        availableQuantity: lot.availableQuantity,
        status,
        label: status === 'EXPIRED' ? 'Caducado' : 'Próximo a caducar',
      }];
    })
    .sort((left, right) => left.expirationDate.localeCompare(right.expirationDate));
}

export function getExpirationAlertCutoff(referenceDate = new Date()): Date {
  const today = toUtcDay(referenceDate);
  return new Date((today ?? 0) + EXPIRATION_WARNING_DAYS * DAY_IN_MILLISECONDS);
}

function toUtcDay(value: Date | string): number | null {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const normalized = new Date(timestamp);

    if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
      return null;
    }

    return timestamp;
  }

  if (!Number.isFinite(value.getTime())) return null;
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}
