import { z } from 'zod';
import { Id } from './schemas';

/** Reorder a column between its new neighbours (one row written). */
export const MoveColumnInput = z
  .object({
    columnId: Id,
    beforeId: Id.nullable(),
    afterId: Id.nullable(),
  })
  .strict();

export type MoveColumnInput = z.infer<typeof MoveColumnInput>;
