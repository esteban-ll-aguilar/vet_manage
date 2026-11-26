import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { Authenticated } from './decorators/require-permissions.decorator.js';
import { ChangePasswordDto } from './dtos/change-password.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { PasswordResetConfirmDto } from './dtos/password-reset-confirm.dto.js';
import { PasswordResetRequestDto } from './dtos/password-reset-request.dto.js';
import { AccessService } from './services/access.service.js';
import { AuthService } from './services/auth.service.js';
import { ChangePasswordService } from './services/change-password.service.js';
import { RecoverPasswordService } from './services/recover-password.service.js';
import type { SessionMeta } from './services/session.service.js';
import type { AuthenticatedRequest } from './types/authenticated-request.js';
import type { AuthSession, LoginResult } from './types/session-profile.js';

export const REFRESH_COOKIE = 'vetmanage_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly access: AccessService,
    private readonly recoverPassword: RecoverPasswordService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(input, sessionMeta(request));
    return success(this.withCookie(session, request, response), 'Sesión iniciada correctamente');
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const session = await this.auth.refresh(readCookie(request, REFRESH_COOKIE), sessionMeta(request));
      return success(this.withCookie(session, request, response), 'Sesión renovada');
    } catch (error) {
      response.clearCookie(REFRESH_COOKIE, this.cookieOptions(request));
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readCookie(request, REFRESH_COOKIE));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(request));
    return success(null, 'Sesión cerrada');
  }

  @Get('me')
  @Authenticated()
  async me(@Req() request: AuthenticatedRequest) {
    const profile = request.user && (await this.access.getSessionProfile(request.user.id));
    if (!profile) throw ApiException.unauthorized();
    return success(profile);
  }

  @Post('change-password')
  @HttpCode(200)
  @Authenticated()
  async changePassword(@Body() input: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message } = await this.changePasswordService.changePassword(request.user.id, input);
    return success(null, message);
  }

  // Recuperación de contraseña (HU-58): rutas públicas, sin sesión.
  @Post('password-reset/request')
  @HttpCode(200)
  async requestPasswordReset(@Body() input: PasswordResetRequestDto) {
    const { message } = await this.recoverPassword.request(input);
    return success(null, message);
  }

  @Get('password-reset/validate')
  async validatePasswordReset(@Query('token') token?: string) {
    const { valid, message } = await this.recoverPassword.validate(typeof token === 'string' ? token : undefined);
    return success({ valid }, message);
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmPasswordReset(@Body() input: PasswordResetConfirmDto) {
    const { message } = await this.recoverPassword.confirm(input);
    return success(null, message);
  }

  // Guarda el refresh token en una cookie httpOnly y devuelve el resto de la sesión.
  private withCookie(session: AuthSession, request: Request, response: Response): LoginResult {
    const { refreshToken, refreshExpiresAt, ...result } = session;
    response.cookie(REFRESH_COOKIE, refreshToken, { ...this.cookieOptions(request), expires: refreshExpiresAt });
    return result;
  }

  // La cookie solo se envía a las rutas de autenticación.
  private cookieOptions(request: Request): CookieOptions {
    const path = request.originalUrl.split('?')[0].replace(/\/(login|refresh|logout)$/, '');
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('app.nodeEnv') === 'production',
      path,
    };
  }
}

function sessionMeta(request: Request): SessionMeta {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') };
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.cookie?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}
