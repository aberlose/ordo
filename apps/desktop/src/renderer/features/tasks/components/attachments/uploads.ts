import { useCallback } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import i18n from '@renderer/i18n';
import { useFeedback } from '@renderer/shared/feedback/store';
import { useAddAttachmentData, useAddAttachmentPaths, usePickAttachments } from '../../hooks/attachments';

/**
 * Files being copied into the app's data folder, and copies that failed (approved mockup:
 * notes-attachments/Attachments A, "Copie en cours · échec"). Ephemeral: never persisted.
 */
export type UploadSource =
  | { readonly kind: 'path'; readonly path: string }
  /** A dropped file without a path on disk (Electron gives none): sent as bytes. */
  | { readonly kind: 'data'; readonly file: File };

export interface Upload {
  readonly id: string;
  readonly taskId: string;
  readonly fileName: string;
  readonly status: 'copying' | 'failed';
  readonly source: UploadSource;
}

interface UploadState {
  uploads: readonly Upload[];
  start: (taskId: string, entries: readonly { fileName: string; source: UploadSource }[]) => string[];
  setStatus: (ids: readonly string[], status: Upload['status']) => void;
  remove: (ids: readonly string[]) => void;
}

let nextId = 0;

export const useUploads = create<UploadState>((set) => ({
  uploads: [],
  start: (taskId, entries) => {
    const added = entries.map((entry): Upload => ({
      id: `upload-${++nextId}`,
      taskId,
      status: 'copying',
      ...entry,
    }));
    set((state) => ({ uploads: [...state.uploads, ...added] }));
    return added.map((upload) => upload.id);
  },
  setStatus: (ids, status) =>
    set((state) => ({
      uploads: state.uploads.map((upload) => (ids.includes(upload.id) ? { ...upload, status } : upload)),
    })),
  remove: (ids) => set((state) => ({ uploads: state.uploads.filter((upload) => !ids.includes(upload.id)) })),
}));

/** The task's copying and failed tiles, in order. */
export function useTaskUploads(taskId: string): readonly Upload[] {
  return useUploads(useShallow((state) => state.uploads.filter((upload) => upload.taskId === taskId)));
}

/** A dropped `File`: its path through the preload, or its bytes when it has none. */
export function fileSource(file: File): UploadSource {
  const path = window.api.getPathForFile(file);
  return path === '' ? { kind: 'data', file } : { kind: 'path', path };
}

function toast(action: 'pickAttachments') {
  useFeedback.getState().showToast(i18n.t(`feedback.failed.${action}`));
}

/** Copies that failed: red tiles, announced through the polite live region (the tile is not focused). */
function markFailed(ids: readonly string[]) {
  if (ids.length === 0) return;
  const { uploads, setStatus } = useUploads.getState();
  setStatus(ids, 'failed');
  const names = uploads.filter((u) => ids.includes(u.id)).map((u) => u.fileName);
  useFeedback
    .getState()
    .announce(
      names.length === 1
        ? i18n.t('attachments.failedAnnounce', { name: names[0] })
        : i18n.t('attachments.failedAnnounceMany', { count: names.length }),
    );
}

/**
 * Adds files to a task with a "Copie…" tile per file while the main process copies them; a file that
 * fails stays as a red tile with Réessayer (`retry`) and × (`dismiss`).
 */
export function useAttachmentUploads(boardId: string, taskId: string) {
  const { mutateAsync: addPaths } = useAddAttachmentPaths(boardId, taskId);
  const { mutateAsync: addData } = useAddAttachmentData(boardId, taskId);
  const { mutateAsync: pickFiles, isPending: picking } = usePickAttachments(boardId, taskId);

  const run = useCallback(
    async (uploads: readonly { id: string; source: UploadSource; fileName: string }[]) => {
      const { remove } = useUploads.getState();
      const byPath = uploads.filter((u) => u.source.kind === 'path');
      const byData = uploads.filter((u) => u.source.kind === 'data');
      const jobs: Promise<void>[] = [];
      if (byPath.length > 0) {
        const paths = byPath.map((u) => (u.source as { path: string }).path);
        jobs.push(
          addPaths(paths).then(
            (result) => {
              const failed = new Set(result.failures.map((f) => f.path));
              const ids = (fail: boolean) =>
                byPath
                  .filter((u) => failed.has((u.source as { path: string }).path) === fail)
                  .map((u) => u.id);
              remove(ids(false));
              markFailed(ids(true));
            },
            () => markFailed(byPath.map((u) => u.id)),
          ),
        );
      }
      for (const upload of byData) {
        const file = (upload.source as { file: File }).file;
        jobs.push(
          file
            .arrayBuffer()
            .then((buffer) =>
              addData({
                fileName: upload.fileName,
                mimeType: file.type || 'application/octet-stream',
                bytes: new Uint8Array(buffer),
              }),
            )
            .then(
              () => remove([upload.id]),
              () => markFailed([upload.id]),
            ),
        );
      }
      await Promise.all(jobs);
    },
    [addPaths, addData],
  );

  /** Files dropped on the window. */
  const addFiles = useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return Promise.resolve();
      const entries = files.map((file) => ({ fileName: file.name, source: fileSource(file) }));
      const ids = useUploads.getState().start(taskId, entries);
      return run(entries.map((entry, i) => ({ ...entry, id: ids[i]! })));
    },
    [run, taskId],
  );

  /**
   * "Ajouter ou déposer": the native dialog and the copy are one call, so the copied files are not
   * known while it runs: the add tile itself shows the indeterminate "Copie…" (`picking`). Failures
   * come back as red tiles.
   */
  const pick = useCallback(async () => {
    try {
      const result = await pickFiles();
      if (result.failures.length > 0) {
        const ids = useUploads.getState().start(
          taskId,
          result.failures.map((f) => ({ fileName: f.fileName, source: { kind: 'path', path: f.path } })),
        );
        markFailed(ids);
      }
    } catch {
      toast('pickAttachments');
    }
  }, [pickFiles, taskId]);

  const retry = useCallback(
    (upload: Upload) => {
      useUploads.getState().setStatus([upload.id], 'copying');
      void run([upload]);
    },
    [run],
  );

  const dismiss = useCallback((upload: Upload) => useUploads.getState().remove([upload.id]), []);

  return { addFiles, pick, picking, retry, dismiss };
}
