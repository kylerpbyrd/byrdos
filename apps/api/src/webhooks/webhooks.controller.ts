import { Controller, Post, Req, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES, type WebhookJobData } from '@byrdos/queue';
import type { Request } from 'express';

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
  async plaidWebhook(
    @Req() req: Request,
    @Headers('plaid-verification') signature: string,
  ) {
    const payload = req.body;

    await this.webhookQueue.add(`plaid-${payload.webhook_code || 'unknown'}`, {
      providerId: 'plaid',
      webhookType: payload.webhook_type || 'UNKNOWN',
      webhookCode: payload.webhook_code || 'UNKNOWN',
      payload,
      signature: signature || '',
      receivedAt: new Date().toISOString(),
    });

    return { acknowledged: true };
  }
}
