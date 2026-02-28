import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  getStatus(): string {
    return 'API Gateway is running';
  }

  burnCpu(durationMs: number): { durationMs: number; iterations: number } {
    const start = Date.now();
    let iterations = 0;
    // Busy loop to consume CPU for roughly durationMs
    while (Date.now() - start < durationMs) {
      // Some arbitrary math to keep the optimizer from removing the loop
      Math.sqrt(iterations * 123.456 + 789);
      iterations++;
    }
    return { durationMs, iterations };
  }

  forceServerError(statusCode: number, message?: string): never {
    const normalizedStatus = Number.isInteger(statusCode) ? statusCode : 500;
    if (normalizedStatus < 500 || normalizedStatus > 599) {
      throw new InternalServerErrorException(
        'Forced error status must be between 500 and 599',
      );
    }
    throw new HttpException(
      message || `Forced ${normalizedStatus} error for alerting validation`,
      normalizedStatus,
    );
  }
}
