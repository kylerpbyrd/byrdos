import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class SessionController {
  @Get()
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      properties: {
        userId: { type: 'string' },
        email: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      userId: req.user.userId,
      email: req.user.email,
    };
  }
}
