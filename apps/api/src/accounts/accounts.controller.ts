import { Controller, Get, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { db, DrizzleAccountRepository } from '@byrdos/db';
import type { Account, PaginatedResult } from '@byrdos/domain';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { paginationQuerySchema, type PaginationQueryDto } from '../common/request-schemas.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  private readonly accountRepo = new DrizzleAccountRepository(db);

  @Get()
  @ApiOperation({ summary: 'List accounts for the authenticated user' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size limit (1-100)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of accounts',
    schema: {
      properties: {
        items: { type: 'array' },
        nextCursor: { type: 'string', nullable: true },
        hasMore: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async list(
    @Req() req: AuthRequest,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQueryDto,
  ): Promise<PaginatedResult<Account>> {
    return this.accountRepo.findByUserId(req.user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account details', type: Object })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async get(@Req() req: AuthRequest, @Param('id') id: string): Promise<Account> {
    const account = await this.accountRepo.findByIdAndUserId(id, req.user.userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }
}
