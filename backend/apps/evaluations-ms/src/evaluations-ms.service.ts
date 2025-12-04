import { Injectable } from '@nestjs/common';

@Injectable()
export class EvaluationsMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
