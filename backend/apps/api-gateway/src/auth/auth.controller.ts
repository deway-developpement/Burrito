import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { Request } from 'express';
import { User } from '@app/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request & { user: User }) {
    return this.authService.login(req.user);
  }

  @Get('refresh')
  async refresh(@Req() req: Request) {
    return this.authService.refresh(req);
  }
}
