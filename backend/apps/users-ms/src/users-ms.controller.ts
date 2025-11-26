import { Controller, Get } from '@nestjs/common';
import { UsersMsService } from './users-ms.service';

@Controller()
export class UsersMsController {
  constructor(private readonly usersMsService: UsersMsService) {}

  @Get()
  getHello(): string {
    return this.usersMsService.getHello();
  }
}
