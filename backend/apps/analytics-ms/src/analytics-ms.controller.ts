import { Controller, Get } from '@nestjs/common';
import { AnalyticsMsService } from './analytics-ms.service';

@Controller()
export class AnalyticsMsController {
  constructor(private readonly analyticsMsService: AnalyticsMsService) {}

  @Get()
  getHello(): string {
    return this.analyticsMsService.getHello();
  }
}
