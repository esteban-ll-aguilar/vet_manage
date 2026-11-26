
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { ResourcesController } from './resources.controller.js';

describe('ResourcesController - HU-006', () => {
  it('protege la consulta de recursos con resources:read-availability', () => {
    const method = Object.getOwnPropertyDescriptor(
      ResourcesController.prototype,
      'consultAvailableResources',
    )?.value;

    expect(
      Reflect.getMetadata(
        PERMISSIONS_METADATA,
        method as object,
      ),
    ).toEqual(['resources:read-availability']);
  });
});
