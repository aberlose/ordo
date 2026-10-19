import { z } from 'zod';
import type { Channel } from './channels';
import type { Result } from './result';
import {
  ArchiveBoardInput,
  ArchiveBoardOutput,
  ArchivedBoard,
  BoardDetail,
  BoardSummary,
  Column,
  CreateBoardInput,
  DuplicateBoardInput,
  MoveBoardInput,
  RestoreBoardInput,
  UpdateBoardInput,
} from './boards';
import {
  CreateColumnInput,
  DeleteColumnInput,
  DeleteColumnOutput,
  MoveColumnInput,
  UpdateColumnInput,
} from './columns';
import {
  AddAttachmentDataInput,
  AddAttachmentsInput,
  AddAttachmentsOutput,
  Attachment,
  AttachmentIdInput,
  ListAttachmentsInput,
  PickAttachmentsInput,
} from './attachments';
import { AppInfo, Empty, Id } from './schemas';
import { CreateTagInput, DeleteTagInput, DeleteTagOutput, Tag, TaskTagInput, UpdateTagInput } from './tags';
import {
  CreateTaskInput,
  DeleteTaskInput,
  DescriptionOutput,
  GetTaskInput,
  ListSubtasksInput,
  MoveTaskInput,
  Task,
  UpdateDescriptionInput,
  UpdateTaskInput,
} from './tasks';

/**
 * The IPC contract: one entry per channel, input and output validated with Zod.
 * Types are inferred from the schemas — never written twice.
 */
export const contract = {
  'app.info': { input: Empty, output: AppInfo },
  'boards.list': { input: Empty, output: z.array(BoardSummary) },
  'boards.get': { input: z.object({ id: Id }).strict(), output: BoardDetail },
  'boards.create': { input: CreateBoardInput, output: BoardDetail },
  'boards.update': { input: UpdateBoardInput, output: BoardSummary },
  'boards.move': { input: MoveBoardInput, output: BoardSummary },
  'boards.duplicate': { input: DuplicateBoardInput, output: BoardSummary },
  'boards.archive': { input: ArchiveBoardInput, output: ArchiveBoardOutput },
  'boards.restore': { input: RestoreBoardInput, output: BoardSummary },
  /** Archived boards, most recently archived first. */
  'boards.listArchived': { input: Empty, output: z.array(ArchivedBoard) },
  'tasks.create': { input: CreateTaskInput, output: Task },
  'tasks.update': { input: UpdateTaskInput, output: Task },
  /** Soft delete: the task (with its sub-tasks) goes to the trash (lot 8 lists and restores it). */
  'tasks.delete': { input: DeleteTaskInput, output: z.object({ id: Id }) },
  'tasks.move': { input: MoveTaskInput, output: Task },
  'tasks.get': { input: GetTaskInput, output: Task },
  'tasks.listSubtasks': { input: ListSubtasksInput, output: z.array(Task) },
  'tasks.addTag': { input: TaskTagInput, output: Task },
  'tasks.removeTag': { input: TaskTagInput, output: Task },
  'tasks.getDescription': { input: GetTaskInput, output: DescriptionOutput },
  'tasks.updateDescription': { input: UpdateDescriptionInput, output: DescriptionOutput },
  /** A task's files, oldest first. */
  'attachments.list': { input: ListAttachmentsInput, output: z.array(Attachment) },
  'attachments.add': { input: AddAttachmentsInput, output: AddAttachmentsOutput },
  'attachments.pick': { input: PickAttachmentsInput, output: AddAttachmentsOutput },
  'attachments.addData': { input: AddAttachmentDataInput, output: Attachment },
  'attachments.open': { input: AttachmentIdInput, output: Empty },
  'attachments.reveal': { input: AttachmentIdInput, output: Empty },
  /** Permanent: the row and the file go. */
  'attachments.delete': { input: AttachmentIdInput, output: z.object({ id: Id }) },
  'tags.create': { input: CreateTagInput, output: Tag },
  'tags.update': { input: UpdateTagInput, output: Tag },
  /** Permanent: the tag and its links go. */
  'tags.delete': { input: DeleteTagInput, output: DeleteTagOutput },
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
  /**
   * Absolute path of a file dropped on the window (a DOM `File`; Electron's `webUtils.getPathForFile`),
   * `''` for a file that has none (pasted data).
   */
  getPathForFile(file: unknown): string;
}
