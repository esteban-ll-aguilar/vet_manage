import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { AppointmentsController } from './appointments.controller.js';

describe('AppointmentsController - HU-003', () => {
  it('protege el registro con appointments:create', () => {
    const method = Object.getOwnPropertyDescriptor(
      AppointmentsController.prototype,
      'register',
    )?.value;

    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual([
      'appointments:create',
    ]);
  });
});
