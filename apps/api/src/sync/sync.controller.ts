import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { db, integrations, providerConnections } from '@byrdos/db';
import { QUEUES, type SyncJobData } from '@byrdos/queue';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  private syncQueue: Queue<SyncJobData>;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.syncQueue = new Queue<SyncJobData>(QUEUES.SYNC, { connection });
  }

  /** Trigger an on-demand sync for a specific connection */
  @Post(':connectionId')
  async triggerSync(
    @Req() req: AuthRequest,
    @Param('connectionId') connectionId: string,
  ) {
    const connRows = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, connectionId))
      .limit(1);

    if (connRows.length === 0) {
      return { error: 'Connection not found' };
    }

    const conn = connRows[0];
    const intRows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, conn.integrationId))
      .limit(1);

    if (intRows.length === 0) {
      return { error: 'Integration not found' };
    }

    const integration = intRows[0];

    // Verify ownership
    if (integration.userId !== req.user.userId) {
      return { error: 'Forbidden' };
    }

    await this.syncQueue.add(`on-demand-${connectionId}`, {
      connectionId: conn.id,
      integrationId: conn.integrationId,
      userId: req.user.userId,
      providerId: integration.providerId,
      trigger: 'on_demand',
    });

    return { success: true, message: 'Sync triggered' };
  }
}
