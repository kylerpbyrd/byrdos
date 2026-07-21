import { Controller, Post, Req, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES, type WebhookJobData } from '@byrdos/queue';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { plaidWebhookBodySchema } from '../common/request-schemas.js';

@ApiTags('webhooks')
@Controller('webhooks')
@Public() // Webhooks are authenticated by signature, not JWT
export class WebhooksController {
  private readonly webhookQueue: Queue<WebhookJobData>;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.webhookQueue = new Queue<WebhookJobData>(QUEUES.WEBHOOKS, { connection });
  }

  @Post('plaid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Plaid webhook events' })
  @ApiBody({ description: 'Plaid webhook payload', type: Object })
  @ApiResponse({
    status: 200,
    description: 'Webhook acknowledged',
    schema: { properties: { acknowledged: { type: 'boolean' } } },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async plaidWebhook(
    @Req() req: Request,
    @Headers('plaid-verification') signature: string,
    @Body(new ZodValidationPipe(plaidWebhookBodySchema)) payload: Record<string, unknown>,
  ) {
    await this.webhookQueue.add(`plaid-${payload.webhook_code || 'unknown'}`, {
      providerId: 'plaid',
      webhookType: (payload.webhook_type as string) || 'UNKNOWN',
      webhookCode: (payload.webhook_code as string) || 'UNKNOWN',
      payload,
      signature: signature || '',
      receivedAt: new Date().toISOString(),
    });

    return { acknowledged: true };
  }
}
