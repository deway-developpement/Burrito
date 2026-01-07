import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
