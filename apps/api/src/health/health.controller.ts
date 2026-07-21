import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { HealthService } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    const [database, redis] = await Promise.all([
      this.healthService.isDatabaseHealthy(),
      this.healthService.isRedisHealthy(),
    ]);

    const healthy = database && redis;

    return res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ready' : 'unhealthy',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    });
  }
}
