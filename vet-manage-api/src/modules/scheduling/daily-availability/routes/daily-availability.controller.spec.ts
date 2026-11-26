import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { DailyAvailabilityController } from './daily-availability.controller.js';

describe('DailyAvailabilityController', () => {
  it('protege la consulta y la edición con daily-availability:manage-own', () => {
    for (const methodName of ['mine', 'save', 'reset']) {
      const method = Object.getOwnPropertyDescriptor(
        DailyAvailabilityController.prototype,
        methodName,
      )?.value;
      expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual([
        'daily-availability:manage-own',
      ]);
    }
  });
});
