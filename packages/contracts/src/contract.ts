import { z } from 'zod';
import type { Channel } from './channels';
import type { Result } from './result';
import { BoardDetail, BoardSummary, Column, CreateBoardInput } from './boards';
import {
  CreateColumnInput,
  DeleteColumnInput,
  DeleteColumnOutput,
  MoveColumnInput,
  UpdateColumnInput,
} from './columns';
import { AppInfo, Empty, Id } from './schemas';
import { CreateTaskInput, DeleteTaskInput, MoveTaskInput, Task, UpdateTaskInput } from './tasks';

/**
 * The IPC contract: one entry per channel, input and output validated with Zod.
 * Types are inferred from the schemas — never written twice.
 */
export const contract = {
  'app.info': { input: Empty, output: AppInfo },
  'boards.list': { input: Empty, output: z.array(BoardSummary) },
  'boards.get': { input: z.object({ id: Id }).strict(), output: BoardDetail },
  'boards.create': { input: CreateBoardInput, output: BoardDetail },
  'tasks.create': { input: CreateTaskInput, output: Task },
  'tasks.update': { input: UpdateTaskInput, output: Task },
  /** Soft delete: the task goes to the trash (lot 8 lists and restores it). */
  'tasks.delete': { input: DeleteTaskInput, output: z.object({ id: Id }) },
  'tasks.move': { input: MoveTaskInput, output: Task },
  'columns.move': { input: MoveColumnInput, output: Column },
  'columns.create': { input: CreateColumnInput, output: Column },
  'columns.update': { input: UpdateColumnInput, output: Column },
  'columns.delete': { input: DeleteColumnInput, output: DeleteColumnOutput },
} as const satisfies Record<Channel, { input: z.ZodType; output: z.ZodType }>;

export type Contract = typeof contract;
export type Input<C extends Channel> = z.input<Contract[C]['input']>;
export type Output<C extends Channel> = z.output<Contract[C]['output']>;

/** What the preload exposes on `window.api`. */
export interface OrdoApi {
  invoke<C extends Channel>(channel: C, input: Input<C>): Promise<Result<Output<C>>>;
}
