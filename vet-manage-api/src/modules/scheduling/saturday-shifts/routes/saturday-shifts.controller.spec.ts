import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { SaturdayShiftsController } from './saturday-shifts.controller.js';

describe('SaturdayShiftsController', () => {
  it('protege la consulta con saturday-shifts:read', () => {
    const method = Object.getOwnPropertyDescriptor(SaturdayShiftsController.prototype, 'list')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['saturday-shifts:read']);
  });

  it('protege generación y sustitución con saturday-shifts:manage', () => {
    const generate = Object.getOwnPropertyDescriptor(SaturdayShiftsController.prototype, 'generate')?.value;
    const substitute = Object.getOwnPropertyDescriptor(SaturdayShiftsController.prototype, 'substitute')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, generate as object)).toEqual(['saturday-shifts:manage']);
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, substitute as object)).toEqual(['saturday-shifts:manage']);
  });
});
