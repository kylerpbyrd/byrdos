import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodType, ZodTypeDef, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(this.formatError(result.error));
    }
    return result.data;
  }

  private formatError(error: ZodError): string {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
}
