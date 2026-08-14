import { Controller, Post, Get, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { IntegrationService, type LinkListItem, type LinkMetadata } from './integration.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  initiateLinkBodySchema,
  exchangeTokenBodySchema,
  relinkExchangeBodySchema,
  type InitiateLinkBodyDto,
  type ExchangeTokenBodyDto,
  type RelinkExchangeBodyDto,
} from '../common/request-schemas.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('links')
@ApiBearerAuth()
@Controller('links')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a provider link flow' })
  @ApiBody({
    description: 'Provider link initiation request',
    schema: {
      properties: {
        providerId: { type: 'string', enum: ['plaid', 'mx', 'akoya', 'varo-direct'] },
      },
      required: ['providerId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Link token and integration ID',
    schema: {
      properties: {
        linkToken: { type: 'string' },
        integrationId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async initiate(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(initiateLinkBodySchema)) body: InitiateLinkBodyDto,
  ) {
    return this.integrationService.initiateLink(req.user.userId, body.providerId);
  }

  @Post('exchange')
  @ApiOperation({ summary: 'Exchange a public token for an access token' })
  @ApiBody({
    description: 'Token exchange request',
    schema: {
      properties: {
        integrationId: { type: 'string' },
        publicToken: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['integrationId', 'publicToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Created provider connection',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async exchange(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(exchangeTokenBodySchema)) body: ExchangeTokenBodyDto,
  ) {
    return this.integrationService.exchangeToken(
      body.integrationId,
      body.publicToken,
      req.user.userId,
      body.metadata as LinkMetadata,
    );
  }

  @Post(':id/reconnect')
  @ApiOperation({ summary: 'Generate a re-link token for update mode' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: 200,
    description: 'Re-link token',
    schema: { properties: { linkToken: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection or credential not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async reconnect(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.integrationService.initiateReconnect(id, req.user.userId);
  }

  @Post(':id/reconnect/exchange')
  @ApiOperation({ summary: 'Exchange a re-link public token and re-sync an existing connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiBody({
    description: 'Re-link token exchange request',
    schema: {
      properties: {
        publicToken: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['publicToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated provider connection',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection, integration, or credential not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async exchangeReconnect(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(relinkExchangeBodySchema)) body: RelinkExchangeBodyDto,
  ) {
    return this.integrationService.exchangeReconnect(
      id,
      body.publicToken,
      req.user.userId,
      body.metadata as LinkMetadata,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List provider links for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of integrations with their provider connection',
    type: Object,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async list(@Req() req: AuthRequest): Promise<LinkListItem[]> {
    return this.integrationService.listIntegrations(req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a provider link' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Connection revoked',
    schema: { properties: { success: { type: 'boolean' } } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async revoke(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.integrationService.revokeConnection(id, req.user.userId);
    return { success: true };
  }
}
