import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: this.formatErrors(result.error),
      });
    }
    return result.data;
  }

  private formatErrors(error: ZodError) {
    return error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  static for<T>(schema: ZodSchema<T>): ZodValidationPipe<T> {
    return new ZodValidationPipe(schema);
  }
}
