import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
