import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request } from 'express';
import { AuthCredentials, IUser } from '@app/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request & { user: IUser }) {
    return this.authService.login(req.user);
  }

  @Get('refresh')
  async refresh(@Req() req: Request) {
    return this.authService.refresh(req);
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    return this.authService.logout(req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: Request & { user: AuthCredentials }) {
    return this.authService.logoutAllSessions(req.user.id);
  }
}
