import { Controller, Get } from '@nestjs/common';
import { PrometheusService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly promService: PrometheusService) {}

  @Get()
  getMetrics() {
    return this.promService.getMetrics();
  }
}
