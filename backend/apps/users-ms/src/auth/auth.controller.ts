import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import type { JwtPayload } from '@app/common';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth.validateUser' })
  validateUser(data: { username: string; password: string }) {
    return this.authService.validateUser(data.username, data.password);
  }

  @MessagePattern({ cmd: 'auth.login' })
  login(data: JwtPayload) {
    return this.authService.login(data);
  }

  @MessagePattern({ cmd: 'auth.refresh' })
  refresh(data: { refreshToken: string }) {
    return this.authService.refresh(data.refreshToken);
  }

  @MessagePattern({ cmd: 'auth.generateFormHash' })
  generateFormHash(data: { userId: string; formId: string }): Promise<string> {
    return this.authService.generateFormHash(data.userId, data.formId);
  }
}
