import type { Attachment, Output } from '@ordo/contracts';
import { isEmptyDescription, type DocNode } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { call } from '@renderer/shared/api/client';
import { descriptionKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import i18n from '@renderer/i18n';
import { useAddAttachmentData, useAddAttachmentPaths } from './attachments';

/**
 * Notes of a task (lot 6): the editor's document, loaded once when the detail opens, saved
 * "invisibly" 500 ms after the last change (docs/architecture.md).
 */

type Description = Output<'tasks.getDescription'>;
/** The editor's document as sent to the main process: `null` for no notes. */
export type NotesDoc = Description['json'];

export const AUTOSAVE_DELAY_MS = 500;

export function useDescription(taskId: string) {
  return useQuery({
    queryKey: descriptionKeys.detail(taskId),
    queryFn: () => call('tasks.getDescription', { id: taskId }),
  });
}

/** The last document asked for, per task: a retry sends it, never an older one. */
const latest = new Map<string, NotesDoc>();

/** A document with no text and no image is stored as `null` (no notes). */
export function toStoredDoc(doc: DocNode): NotesDoc {
  return isEmptyDescription(doc) ? null : (doc as NonNullable<NotesDoc>);
}

/**
 * Saves the notes. The cache is updated at once (reopening the task shows the latest text even while
 * the save runs); a failure shows the toast with "Réessayer". Callbacks live on the mutation, so a
 * save flushed while the window closes still reports its error.
 */
export function useSaveDescription(taskId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (json: NotesDoc) => call('tasks.updateDescription', { id: taskId, json }),
    onMutate: (json) => {
      latest.set(taskId, json);
      client.setQueryData<Description>(descriptionKeys.detail(taskId), (previous) => ({
        id: taskId,
        json,
        updatedAt: previous?.updatedAt ?? Date.now(),
      }));
    },
    // Only the newest save may write its answer (an older one finishing late would roll the text back).
    onSuccess: (saved, json) => {
      if (latest.get(taskId) === json) client.setQueryData(descriptionKeys.detail(taskId), saved);
    },
    onError: () => {
      useFeedback.getState().showToast(i18n.t('feedback.failed.saveNotes'), () => {
        if (latest.has(taskId)) mutation.mutate(latest.get(taskId) ?? null);
      });
    },
  });
  return mutation;
}

/**
 * Debounced save: `schedule` (each change) waits `delay` after the last call, `flush` saves a pending
 * document right away (blur, task switch, window close, unmount). Pure timing, no React: tested alone.
 */
export function createAutosave<T>(save: (value: T) => void, delay = AUTOSAVE_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | null = null;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    save(value);
  };
  return {
    schedule(value: T) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    /** A document is waiting for its save. */
    get pending() {
      return pending !== null;
    },
    cancel() {
      clearTimeout(timer);
      pending = null;
    },
  };
}

/**
 * The autosave of one task's notes. `schedule(doc)` on every change; flushed on unmount and when the
 * window is closed. `onSaved` runs after each successful save (the "Enregistré" hint).
 */
export function useNotesAutosave(taskId: string, onSaved?: () => void) {
  const save = useSaveDescription(taskId);
  const send = useRef<(json: NotesDoc) => void>(() => {});
  useLayoutEffect(() => {
    send.current = (json) => save.mutate(json, { onSuccess: () => onSaved?.() });
  });
  const autosave = useRef<ReturnType<typeof createAutosave<NotesDoc>> | null>(null);
  useLayoutEffect(() => {
    const instance = createAutosave<NotesDoc>((json) => send.current(json));
    autosave.current = instance;
    const onUnload = () => instance.flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      instance.flush();
    };
  }, []);

  const schedule = useCallback((doc: DocNode) => autosave.current?.schedule(toStoredDoc(doc)), []);
  const flush = useCallback(() => autosave.current?.flush(), []);
  return { schedule, flush };
}

const isImage = (attachment: Attachment) => attachment.mimeType?.startsWith('image/') ?? false;

/**
 * Image files pasted, dropped or picked in the notes, copied into the task's attachments. Files with
 * a path on disk (dropped, picked) are copied by the main process; pasted data is sent as bytes.
 * Resolves to the image attachments, in order, to insert in the note. A failure shows the toast.
 */
export function useAddNoteImages(boardId: string, taskId: string) {
  const addPaths = useAddAttachmentPaths(boardId, taskId);
  const addData = useAddAttachmentData(boardId, taskId);
  return useCallback(
    async (files: readonly File[]): Promise<Attachment[]> => {
      const withPath: string[] = [];
      const withoutPath: File[] = [];
      for (const file of files) {
        let path: string;
        try {
          path = window.api.getPathForFile(file);
        } catch {
          path = '';
        }
        if (path) withPath.push(path);
        else withoutPath.push(file);
      }
      const added: Attachment[] = [];
      let failed = false;
      if (withPath.length > 0) {
        try {
          const result = await addPaths.mutateAsync(withPath);
          added.push(...result.attachments);
          failed ||= result.failures.length > 0;
        } catch {
          failed = true;
        }
      }
      for (const file of withoutPath) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const extension = file.type.split('/')[1]?.replace(/\W.*$/, '') || 'png';
          added.push(
            await addData.mutateAsync({
              fileName: file.name || `image.${extension}`,
              mimeType: file.type || 'application/octet-stream',
              bytes,
            }),
          );
        } catch {
          failed = true;
        }
      }
      if (failed) useFeedback.getState().showToast(i18n.t('feedback.failed.addImage'));
      return added.filter(isImage);
    },
    [addPaths, addData],
  );
}
