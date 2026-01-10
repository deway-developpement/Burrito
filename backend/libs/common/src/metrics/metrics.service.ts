import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class PrometheusService {
  // Use the global register so custom metrics (e.g., makeCounterProvider) and default metrics share the same registry.
  private readonly register: client.Registry = client.register;

  constructor() {
    this.register.setDefaultLabels({ app: 'nestjs-prometheus' });
    // Avoid double-registering default metrics when PrometheusModule already did so.
    if (this.register.getMetricsAsArray().length === 0) {
      client.collectDefaultMetrics({ register: this.register });
    }
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
