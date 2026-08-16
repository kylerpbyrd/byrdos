import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { MetricsService } from './metrics.service.js';

@SkipThrottle()
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Res() res: Response) {
    const text = await this.metricsService.getMetricsText();
    return res.status(HttpStatus.OK).send(text);
  }
}
