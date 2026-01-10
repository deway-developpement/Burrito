import { Injectable } from '@nestjs/common';

@Injectable()
export class FormsMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
