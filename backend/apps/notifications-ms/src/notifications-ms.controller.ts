import { Controller, Get } from '@nestjs/common';
import { NotificationsMsService } from './notifications-ms.service';

@Controller()
export class NotificationsMsController {
  constructor(
    private readonly notificationsMsService: NotificationsMsService,
  ) {}

  @Get()
  getHello(): string {
    return this.notificationsMsService.getHello();
  }
}
