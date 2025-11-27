import { Controller, Get } from '@nestjs/common';
import { FormsMsService } from './forms-ms.service';

@Controller()
export class FormsMsController {
  constructor(private readonly formsMsService: FormsMsService) {}

  @Get()
  getHello(): string {
    return this.formsMsService.getHello();
  }
}
