import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class SessionController {
  @Get()
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      userId: req.user.userId,
      email: req.user.email,
    };
  }
}
