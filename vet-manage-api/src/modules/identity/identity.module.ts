import { Module } from '@nestjs/common';
import { RbacCatalogSynchronizer } from './services/rbac-catalog-synchronizer.service.js';

@Module({
  providers: [RbacCatalogSynchronizer],
  exports: [RbacCatalogSynchronizer],
})
export class IdentityModule {}
