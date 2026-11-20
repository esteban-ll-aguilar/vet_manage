import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../infrastructure/mail/mail.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { UsersController } from './users.controller.js';
import { AuthController } from './auth.controller.js';
import { ClientRegistrationController } from './routes/clients.controller.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { AccessService } from './services/access.service.js';
import { AuthService } from './services/auth.service.js';
import { IdentityBootstrap } from './services/identity-bootstrap.service.js';
import { InitialAdminService } from './services/initial-admin.service.js';
import { PasswordHasher } from './services/password-hasher.service.js';
import { RbacCatalogSynchronizer } from './services/rbac-catalog-synchronizer.service.js';
import { SessionService } from './services/session.service.js';
import { TokenService } from './services/token.service.js';
import { UserQueryRepository } from './repositories/user-query.repository.js';
import { UserQueryService } from './services/user-query.service.js';
import { UserRegistrationService } from './services/user-registration.service.js';
import { ClientRegistrationService } from './services/client-registration.service.js';
import { UserRoleAssignmentService } from './services/user-role-assignment.service.js';

@Module({
  imports: [
    RedisModule,
    MailModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('auth.jwtSecret') }),
    }),
  ],
  controllers: [AuthController, UsersController, ClientRegistrationController],
  providers: [
    RbacCatalogSynchronizer,
    InitialAdminService,
    IdentityBootstrap,
    PasswordHasher,
    TokenService,
    AccessService,
    AuthService,
    SessionService,
    UserRegistrationService,
    ClientRegistrationService,
    UserQueryRepository,
    UserQueryService,
    UserRoleAssignmentService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    RbacCatalogSynchronizer,
    InitialAdminService,
    PasswordHasher,
    TokenService,
    AccessService,
    JwtAuthGuard,
    PermissionsGuard,
    ClientRegistrationService,
  ],
})
export class IdentityModule {}
