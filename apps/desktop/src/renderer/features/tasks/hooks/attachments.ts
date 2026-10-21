import type { AddAttachmentsOutput, Attachment, BoardDetail, Input, Task } from '@ordo/contracts';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { call } from '@renderer/shared/api/client';
import { attachmentKeys, boardKeys, taskKeys } from '@renderer/shared/api/keys';

/**
 * Attachments of a task (lot 6). Shared by the attachment section and the notes editor (pasted and
 * dropped images): the editor inserts an image node pointing to the attachment these hooks return.
 */

/** A task's files, oldest first. */
export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: attachmentKeys.list(taskId),
    queryFn: () => call('attachments.list', { taskId }),
  });
}

/** The card shows `Task.attachmentCount`: keep it in step in the board and the task queries. */
function patchCount(client: QueryClient, boardId: string, taskId: string, delta: number) {
  const patch = (task: Task): Task =>
    task.id === taskId ? { ...task, attachmentCount: Math.max(0, task.attachmentCount + delta) } : task;
  client.setQueryData<BoardDetail>(boardKeys.detail(boardId), (board) =>
    board ? { ...board, tasks: board.tasks.map(patch) } : board,
  );
  client.setQueryData<Task>(taskKeys.detail(taskId), (task) => (task ? patch(task) : task));
}

function appendAll(client: QueryClient, boardId: string, taskId: string, added: readonly Attachment[]) {
  if (added.length === 0) return;
  client.setQueryData<Attachment[]>(attachmentKeys.list(taskId), (list) => [...(list ?? []), ...added]);
  patchCount(client, boardId, taskId, added.length);
}

/** Files dropped on the window (absolute paths from `window.api.getPathForFile`). */
export function useAddAttachmentPaths(boardId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (paths: string[]) => call('attachments.add', { taskId, paths }),
    onSuccess: (result: AddAttachmentsOutput) => appendAll(client, boardId, taskId, result.attachments),
    onSettled: () => void client.invalidateQueries({ queryKey: attachmentKeys.list(taskId) }),
  });
}

/** The native file dialog ("Ajouter ou déposer"); nothing is added when it is cancelled. */
export function usePickAttachments(boardId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => call('attachments.pick', { taskId }),
    onSuccess: (result: AddAttachmentsOutput) => appendAll(client, boardId, taskId, result.attachments),
    onSettled: () => void client.invalidateQueries({ queryKey: attachmentKeys.list(taskId) }),
  });
}

/** A pasted image (bytes, no file on disk). `mutateAsync` resolves to the saved attachment. */
export function useAddAttachmentData(boardId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: Omit<Input<'attachments.addData'>, 'taskId'>) =>
      call('attachments.addData', { taskId, ...file }),
    onSuccess: (attachment) => appendAll(client, boardId, taskId, [attachment]),
  });
}

/** Permanent delete (after the confirmation bubble). */
export function useDeleteAttachment(boardId: string, taskId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call('attachments.delete', { id }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: attachmentKeys.list(taskId) });
      client.setQueryData<Attachment[]>(attachmentKeys.list(taskId), (list) =>
        list?.filter((a) => a.id !== id),
      );
      patchCount(client, boardId, taskId, -1);
    },
    // The list is fetched again; the card's count goes back up (no refetch of the whole board).
    onError: () => patchCount(client, boardId, taskId, 1),
    onSettled: () => void client.invalidateQueries({ queryKey: attachmentKeys.list(taskId) }),
  });
}

export const openAttachment = (id: string) => call('attachments.open', { id });
export const revealAttachment = (id: string) => call('attachments.reveal', { id });
