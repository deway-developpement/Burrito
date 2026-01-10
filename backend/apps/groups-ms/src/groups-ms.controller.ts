import { Controller, Get } from '@nestjs/common';
import { GroupsMsService } from './groups-ms.service';

@Controller()
export class GroupsMsController {
  constructor(private readonly groupsMsService: GroupsMsService) {}

  @Get()
  getHello(): string {
    return this.groupsMsService.getHello();
  }
}
