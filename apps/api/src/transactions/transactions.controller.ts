import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { db, DrizzleTransactionRepository } from '@byrdos/db';
import type { PaginatedResult, Transaction } from '@byrdos/domain';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  transactionListQuerySchema,
  type TransactionListQueryDto,
} from '../common/request-schemas.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  private readonly txnRepo = new DrizzleTransactionRepository(db);

  @Get()
  @ApiOperation({ summary: 'List transactions for the authenticated user or a specific account' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size limit (1-100)' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Filter by account ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (YYYY-MM-DD)' })
  @ApiQuery({
    name: 'pending',
    required: false,
    description: 'Filter by pending status (true/false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
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
    @Query(new ZodValidationPipe(transactionListQuerySchema)) query: TransactionListQueryDto,
  ): Promise<PaginatedResult<Transaction>> {
    const { accountId, ...options } = query;

    if (accountId) {
      return this.txnRepo.findByAccountIdAndUserId(accountId, req.user.userId, options);
    }
    return this.txnRepo.findByUserId(req.user.userId, options);
  }
}
