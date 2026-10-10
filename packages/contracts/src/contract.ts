import { z } from 'zod';
import type { Channel } from './channels';
import type { Result } from './result';
import { AppInfo, BoardDetail, BoardSummary, CreateBoardInput, Empty, Id } from './schemas';

/**
 * The IPC contract: one entry per channel, input and output validated with Zod.
 * Types are inferred from the schemas — never written twice.
 */
export const contract = {
  'app.info': { input: Empty, output: AppInfo },
  'boards.list': { input: Empty, output: z.array(BoardSummary) },
  'boards.get': { input: z.object({ id: Id }).strict(), output: BoardDetail },
  'boards.create': { input: CreateBoardInput, output: BoardDetail },
} as const satisfies Record<Channel, { input: z.ZodType; output: z.ZodType }>;

export type Contract = typeof contract;
export type Input<C extends Channel> = z.input<Contract[C]['input']>;
export type Output<C extends Channel> = z.output<Contract[C]['output']>;

/** What the preload exposes on `window.api`. */
export interface OrdoApi {
  invoke<C extends Channel>(channel: C, input: Input<C>): Promise<Result<Output<C>>>;
}
