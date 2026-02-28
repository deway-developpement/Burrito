import { Controller, Get, Query } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';

@Controller()
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Get('status')
  getStatus(): string {
    return this.apiGatewayService.getStatus();
  }

  @Get('burn')
  burn(@Query('ms') msParam?: string) {
    const parsed = Number.parseInt(msParam ?? '500', 10);
    const clamped = Math.min(
      Math.max(Number.isFinite(parsed) ? parsed : 500, 50),
      10000,
    );
    return this.apiGatewayService.burnCpu(clamped);
  }

  @Get('burn-5xx')
  burn5xx(
    @Query('status') statusParam?: string,
    @Query('message') message?: string,
  ): never {
    const parsed = Number.parseInt(statusParam ?? '500', 10);
    const status = Number.isFinite(parsed) ? parsed : 500;
    return this.apiGatewayService.forceServerError(status, message);
  }
}
