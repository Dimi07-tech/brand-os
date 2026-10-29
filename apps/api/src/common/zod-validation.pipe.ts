import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valide et normalise une entrée avec un schéma de @brand-os/shared. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Données invalides',
        errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
