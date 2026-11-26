export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'vet-manage-api',
    port: Number(process.env.PORT ?? 3080),
    prefix: process.env.API_PREFIX ?? 'api/v1',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    // Dirección pública del frontend; se usa en los enlaces de los correos.
    url: process.env.APP_URL ?? 'http://localhost:5174',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://redis:56379',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    sessionExpiresIn: process.env.SESSION_EXPIRES_IN ?? '12h',
    // Vigencia en minutos del enlace de recuperación de contraseña (HU-58).
    passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30),
  },
  rbac: {
    syncMode: process.env.RBAC_SYNC_MODE ?? 'create-only',
  },
  initialAdmin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    identification: process.env.ADMIN_IDENTIFICATION,
    firstName: process.env.ADMIN_FIRST_NAME,
    lastName: process.env.ADMIN_LAST_NAME,
  },
  mail: {
    host: process.env.SMTP_HOST ?? 'mailpit',
    port: Number(process.env.SMTP_PORT ?? 51025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: process.env.MAIL_FROM ?? 'VetManage <no-reply@vetmanage.local>',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://vetmanage:vetmanage_dev_password@rabbitmq:55672',
  },
});
