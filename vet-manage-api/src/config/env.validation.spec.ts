import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: 'a'.repeat(32),
  ADMIN_EMAIL: 'admin@vetmanage.local',
  ADMIN_PASSWORD: 'Admin12345',
  ADMIN_IDENTIFICATION: '1700000001',
  ADMIN_FIRST_NAME: 'Administrador',
  ADMIN_LAST_NAME: 'Inicial',
};

describe('validateEnvironment', () => {
  it('acepta la configuración mínima con los valores de correo por defecto', () => {
    const env = validateEnvironment({ ...base });

    expect(env).toMatchObject({ SMTP_HOST: 'mailpit', SMTP_PORT: 51025, SMTP_SECURE: false, APP_URL: 'http://localhost:5174' });
  });

  it.each([['abc'], ['0'], ['-5']])('rechaza SMTP_PORT=%s', (port) => {
    expect(() => validateEnvironment({ ...base, SMTP_PORT: port })).toThrow(/SMTP_PORT/);
  });

  it('convierte SMTP_SECURE a booleano y rechaza otros valores', () => {
    expect(validateEnvironment({ ...base, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
    expect(validateEnvironment({ ...base, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false);
    expect(() => validateEnvironment({ ...base, SMTP_SECURE: 'si' })).toThrow(/SMTP_SECURE/);
  });

  it.each([['soporte@clinica.com'], ['VetManage <no-reply@vetmanage.local>']])('acepta MAIL_FROM=%s', (from) => {
    expect(validateEnvironment({ ...base, MAIL_FROM: from }).MAIL_FROM).toBe(from);
  });

  it.each([['no es una direccion'], ['sin-arroba.com'], ['Nombre <correo>'], ['<a@b.co']])('rechaza MAIL_FROM=%s', (from) => {
    expect(() => validateEnvironment({ ...base, MAIL_FROM: from })).toThrow(/MAIL_FROM/);
  });

  it('usa 30 minutos por defecto para el enlace de recuperación y acepta otro valor (HU-58)', () => {
    expect(validateEnvironment({ ...base }).PASSWORD_RESET_TTL_MINUTES).toBe(30);
    expect(validateEnvironment({ ...base, PASSWORD_RESET_TTL_MINUTES: '45' }).PASSWORD_RESET_TTL_MINUTES).toBe(45);
  });

  it.each([['0'], ['-1'], ['media hora']])('rechaza PASSWORD_RESET_TTL_MINUTES=%s', (value) => {
    expect(() => validateEnvironment({ ...base, PASSWORD_RESET_TTL_MINUTES: value })).toThrow(/PASSWORD_RESET_TTL_MINUTES/);
  });

  it('rechaza una APP_URL que no es una dirección web', () => {
    expect(() => validateEnvironment({ ...base, APP_URL: 'ftp://clinica' })).toThrow(/APP_URL/);
    expect(validateEnvironment({ ...base, APP_URL: 'https://app.clinica.com' }).APP_URL).toBe('https://app.clinica.com');
  });

  it('rechaza una cédula de administrador inválida', () => {
    expect(() => validateEnvironment({ ...base, ADMIN_IDENTIFICATION: '1234567890' })).toThrow(/ADMIN_IDENTIFICATION/);
  });
});
