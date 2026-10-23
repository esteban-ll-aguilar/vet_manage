export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'vet-manage-api',
    port: Number(process.env.PORT ?? 3080),
    prefix: process.env.API_PREFIX ?? 'api/v1',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://redis:56379',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://vetmanage:vetmanage_dev_password@rabbitmq:55672',
  },
});
