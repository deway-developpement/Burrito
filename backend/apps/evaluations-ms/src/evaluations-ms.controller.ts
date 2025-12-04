import { Controller, Get } from '@nestjs/common';
import { EvaluationsMsService } from './evaluations-ms.service';

@Controller()
export class EvaluationsMsController {
  constructor(private readonly evaluationsMsService: EvaluationsMsService) {}

  @Get()
  getHello(): string {
    return this.evaluationsMsService.getHello();
  }
}
