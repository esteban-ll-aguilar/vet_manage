import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor() {
    super(process.env.REDIS_URL ?? 'redis://redis:56379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleDestroy() {
    if (this.status !== 'end') {
      await this.quit();
    }
  }
}
