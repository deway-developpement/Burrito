import { Controller, Get, Header } from '@nestjs/common';
import * as client from 'prom-client';
import { PrometheusService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly promService: PrometheusService) {}

  @Get()
  @Header('Content-Type', client.register.contentType)
  getMetrics() {
    return this.promService.getMetrics();
  }
}
