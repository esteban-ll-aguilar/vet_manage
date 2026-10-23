import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma/prisma.service.js';
import { RabbitmqService } from '../infrastructure/rabbitmq/rabbitmq.service.js';
import { RedisService } from '../infrastructure/redis/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'vet-manage-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.ping();
    this.rabbitmq.getChannel();

    return {
      status: 'ready',
      dependencies: { postgres: 'up', redis: 'up', rabbitmq: 'up' },
      timestamp: new Date().toISOString(),
    };
  }
}
