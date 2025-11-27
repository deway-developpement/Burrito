import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  getStatus(): string {
    return 'API Gateway is running';
  }
}
