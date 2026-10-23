import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getDemo() {
    return {
      success: true,
      message: 'La conexión entre Vet Manage y la API funciona correctamente.',
      timestamp: new Date().toISOString(),
      service: 'vet-manage-api',
    };
  }
}
