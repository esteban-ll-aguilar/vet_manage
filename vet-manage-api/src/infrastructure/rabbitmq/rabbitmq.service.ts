import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { Channel, ChannelModel } from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const url = process.env.RABBITMQ_URL ?? 'amqp://vetmanage:vetmanage_dev_password@rabbitmq:55672';

    if (!url) {
      throw new Error('RABBITMQ_URL is required to initialize RabbitMQ');
    }

    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    this.logger.log('RabbitMQ connection established');
  }

  getChannel() {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    return this.channel;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
