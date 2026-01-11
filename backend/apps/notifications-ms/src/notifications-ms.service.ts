import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
