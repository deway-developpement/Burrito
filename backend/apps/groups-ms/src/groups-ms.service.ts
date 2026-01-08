import { Injectable } from '@nestjs/common';

@Injectable()
export class GroupsMsService {
  getHello(): string {
    return 'Hello World!';
  }
}
