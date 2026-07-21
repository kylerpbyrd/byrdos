import { Controller, Post, Get, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { IntegrationService, type LinkMetadata } from './integration.service.js';
import type { Request } from 'express';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('links')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('initiate')
  async initiate(@Req() req: AuthRequest, @Body() body: { providerId: string }) {
    return this.integrationService.initiateLink(req.user.userId, body.providerId);
  }

  @Post('exchange')
  async exchange(
    @Req() req: AuthRequest,
    @Body() body: { integrationId: string; publicToken: string; metadata?: LinkMetadata },
  ) {
    return this.integrationService.exchangeToken(body.integrationId, body.publicToken, body.metadata);
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    return this.integrationService.listIntegrations(req.user.userId);
  }

  @Delete(':id')
  async revoke(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.integrationService.revokeConnection(id);
    return { success: true };
  }
}
