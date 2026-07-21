import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { db, integrations, providerConnections, syncJobs } from '@byrdos/db';
import { QUEUES, type SyncJobData } from '@byrdos/queue';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('sync')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Trigger an on-demand sync for a connection' })
  @ApiParam({ name: 'connectionId', description: 'Provider connection ID' })
  @ApiResponse({
    status: 200,
    description: 'Sync triggered',
    schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection or integration not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async triggerSync(@Req() req: AuthRequest, @Param('connectionId') connectionId: string) {
    const connRows = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, connectionId))
      .limit(1);

    if (connRows.length === 0) {
      throw new NotFoundException('Connection not found');
    }

    const conn = connRows[0];
    const intRows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, conn.integrationId))
      .limit(1);

    if (intRows.length === 0) {
      throw new NotFoundException('Integration not found');
    }

    const integration = intRows[0];

    // Verify ownership
    if (integration.userId !== req.user.userId) {
      throw new ForbiddenException('Forbidden');
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

  /** Get sync status for a connection */
  @Get(':connectionId')
  @ApiOperation({ summary: 'Get sync status for a connection' })
  @ApiParam({ name: 'connectionId', description: 'Provider connection ID' })
  @ApiResponse({
    status: 200,
    description: 'Sync status and recent jobs',
    schema: { type: 'object' },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection or integration not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getSyncStatus(@Req() req: AuthRequest, @Param('connectionId') connectionId: string) {
    const connRows = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, connectionId))
      .limit(1);

    if (connRows.length === 0) {
      throw new NotFoundException('Connection not found');
    }

    const conn = connRows[0];
    const intRows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, conn.integrationId))
      .limit(1);

    if (intRows.length === 0) {
      throw new NotFoundException('Integration not found');
    }
    if (intRows[0].userId !== req.user.userId) {
      throw new ForbiddenException('Forbidden');
    }

    // Get latest sync jobs for this connection
    const jobs = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.connectionId, connectionId))
      .orderBy(syncJobs.createdAt)
      .limit(10);

    return {
      connectionId: conn.id,
      status: conn.status,
      lastWebhookAt: conn.lastWebhookAt,
      recentJobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        trigger: j.trigger,
        createdAt: j.createdAt,
        finishedAt: j.finishedAt,
      })),
    };
  }
}
