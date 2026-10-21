import { ATTACHMENT_NAME_MAX_LENGTH } from '@ordo/domain';
import { z } from 'zod';
import { Id } from './schemas';

/**
 * Attachment files are served to the renderer by the main process through this local protocol, limited
 * to the attachments folder: `ordo-file://attachment/<id>` (thumbnails, images of the notes).
 */
export const ATTACHMENT_PROTOCOL = 'ordo-file';
export const attachmentUrl = (id: string): string => `${ATTACHMENT_PROTOCOL}://attachment/${id}`;

/** A file copied into the app's data folder, attached to a task. */
export const Attachment = z.object({
  id: Id,
  taskId: Id,
  /** Original file name, shown on the tile. */
  fileName: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.number().int(),
  /** `attachmentUrl(id)`. */
  url: z.string(),
});

export const ListAttachmentsInput = z.object({ taskId: Id }).strict();

/** Files dropped on the window, by absolute path (from the preload's `getPathForFile`). */
export const AddAttachmentsInput = z
  .object({
    taskId: Id,
    paths: z.array(z.string().min(1).max(4096)).min(1).max(200),
  })
  .strict();

/** Opens the native file dialog (several files); nothing is added when it is cancelled. */
export const PickAttachmentsInput = z.object({ taskId: Id }).strict();

/** One file per path: copied, or failed with a message (the tile turns red with "Réessayer"). */
export const AddAttachmentsOutput = z.object({
  attachments: z.array(Attachment),
  failures: z.array(z.object({ path: z.string(), fileName: z.string(), message: z.string() })),
});

/** A pasted (or dropped) image without a file on disk: its bytes. */
export const AddAttachmentDataInput = z
  .object({
    taskId: Id,
    fileName: z.string().max(ATTACHMENT_NAME_MAX_LENGTH),
    mimeType: z.string().max(200),
    bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0, 'Empty file'),
  })
  .strict();

/** Open with the default application, show in the Finder / Explorer, or delete (permanent). */
export const AttachmentIdInput = z.object({ id: Id }).strict();

/**
 * `opened: false` when the file is a program or a script (`isExecutableAttachment`): it is shown in the
 * Finder / Explorer instead of being run, and the renderer says why.
 */
export const OpenAttachmentOutput = z.object({ opened: z.boolean() });

export type Attachment = z.infer<typeof Attachment>;
export type AddAttachmentsOutput = z.infer<typeof AddAttachmentsOutput>;
export type OpenAttachmentOutput = z.infer<typeof OpenAttachmentOutput>;
