import type { Attachment } from '@ordo/contracts';
import { Paperclip, RotateCcw } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { AttachmentTile } from './AttachmentTile';
import type { RevealPlatform } from './format';
import type { Upload } from './uploads';
import { IndeterminateBar, UploadTile } from './UploadTile';

export interface AttachmentListProps {
  /** `undefined` while loading: the header and the add tile only. */
  attachments: readonly Attachment[] | undefined;
  /** Copying and failed files of this task. */
  uploads: readonly Upload[];
  reveal: RevealPlatform;
  loadError?: boolean;
  onRetryLoad?: () => void;
  /** The native file dialog. */
  onAdd: () => void;
  /** The native dialog and its copy are running: the add tile shows the indeterminate "Copie…". */
  adding?: boolean;
  onOpen: (attachment: Attachment) => void;
  onReveal: (attachment: Attachment) => void;
  onDelete: (attachment: Attachment) => void;
  onRetryUpload: (upload: Upload) => void;
  onDismissUpload: (upload: Upload) => void;
  /** Stories: the ⋯ menu of this file shown open. */
  menuOpenId?: string;
  /** Stories: the delete confirmation of this file shown open. */
  confirmingId?: string;
}

/** Focuses the first element found among `selectors`, waiting a few frames for it to render. */
function focusSoon(selectors: readonly string[], frames = 10) {
  const found = selectors.map((s) => document.querySelector<HTMLElement>(s)).find(Boolean);
  if (found) found.focus({ focusVisible: true } as FocusOptions);
  else if (frames > 0) requestAnimationFrame(() => focusSoon(selectors, frames - 1));
}

/**
 * The "Pièces jointes" section of the task window (approved mockups: task-detail, and
 * notes-attachments/Attachments A): file tiles, copying and failed tiles, then the dashed
 * "Ajouter ou déposer" tile, which is all an empty section shows.
 */
export function AttachmentList({
  attachments,
  uploads,
  reveal,
  loadError = false,
  onRetryLoad,
  onAdd,
  adding = false,
  onOpen,
  onReveal,
  onDelete,
  onRetryUpload,
  onDismissUpload,
  menuOpenId,
  confirmingId,
}: AttachmentListProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const count = attachments?.length ?? 0;

  // After a delete, the focus goes to the next file, else to the add tile.
  const deleteAndMoveFocus = useCallback(
    (attachment: Attachment) => {
      const list = attachments ?? [];
      const next = list[list.findIndex((a) => a.id === attachment.id) + 1];
      onDelete(attachment);
      focusSoon([
        ...(next ? [`[data-attachment-id="${next.id}"]`] : []),
        `[data-attachment-add="${headingId}"]`,
      ]);
    },
    [attachments, onDelete, headingId],
  );

  return (
    <section aria-labelledby={headingId} className="col-start-1 flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <h2 id={headingId} className="text-input font-semibold">
          {t('attachments.title')}
        </h2>
        {count > 0 && <span className="text-meta text-text-3 tabular-nums">{count}</span>}
      </div>

      {loadError && (
        // Decided with the lot 6 review: the dashed box with a retry, as the archives and sub-tasks.
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-popover border-2 border-dashed border-border p-5.5 text-center"
        >
          <span className="text-meta leading-snug text-text-2">{t('attachments.loadError')}</span>
          {onRetryLoad && (
            <Button onClick={onRetryLoad}>
              <RotateCcw size={14} aria-hidden />
              {t('feedback.retry')}
            </Button>
          )}
        </div>
      )}

      <ul className="flex flex-wrap gap-2.5" aria-labelledby={headingId}>
        {attachments?.map((attachment) => (
          <AttachmentTile
            key={attachment.id}
            attachment={attachment}
            reveal={reveal}
            onOpen={onOpen}
            onReveal={onReveal}
            onDelete={deleteAndMoveFocus}
            defaultMenuOpen={attachment.id === menuOpenId}
            defaultConfirming={attachment.id === confirmingId}
          />
        ))}
        {uploads.map((upload) => (
          <UploadTile key={upload.id} upload={upload} onRetry={onRetryUpload} onDismiss={onDismissUpload} />
        ))}
        <li className="list-none">
          <button
            type="button"
            data-attachment-add={headingId}
            onClick={adding ? undefined : onAdd}
            aria-busy={adding || undefined}
            aria-disabled={adding || undefined}
            className={cn(
              'flex h-13.5 w-59 items-center justify-center gap-2 rounded-card border border-dashed border-border-strong text-meta text-text-3',
              adding ? 'cursor-progress px-4' : 'hover:bg-rail hover:text-text-2',
            )}
          >
            <Paperclip size={15} aria-hidden />
            {adding ? (
              <span className="flex flex-1 items-center gap-1.5">
                <IndeterminateBar />
                {/* Named "Ajouter ou déposer" for assistive technologies, busy. */}
                <span className="shrink-0 text-caption" aria-hidden>
                  {t('attachments.copying')}
                </span>
                <span className="sr-only">{t('attachments.add')}</span>
              </span>
            ) : (
              t('attachments.add')
            )}
          </button>
        </li>
      </ul>
    </section>
  );
}
