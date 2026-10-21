import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dragHasImage } from '../notes/helpers';
import { useAttachmentUploads } from './uploads';

/**
 * The notes' text takes dropped images (inserted in the note): no overlay over it for a drag that
 * carries one. Other files dropped on the text still become attachments, with the overlay.
 */
const EDITOR_SELECTOR = '.ProseMirror';

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

function fileCount(event: DragEvent): number {
  const items = event.dataTransfer?.items;
  if (!items) return 0;
  return Array.from(items).filter((item) => item.kind === 'file').length;
}

/**
 * Approved mockup: notes-attachments/Attachments A, "Fichiers glissés sur la fenêtre": a dashed accent
 * frame over the window, "Déposez pour joindre" and the number of files.
 */
export function DropOverlay({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div
      data-attachment-drop
      aria-hidden
      className="pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-popover border-2 border-dashed border-accent bg-accent-soft/85 text-text"
    >
      <Upload size={26} className="text-accent" />
      <span className="text-title font-semibold">{t('attachments.drop.title')}</span>
      <span className="text-meta text-text-2">
        {count > 0 ? t('attachments.drop.count', { count }) : t('attachments.drop.hint')}
      </span>
    </div>
  );
}

/**
 * Files dropped anywhere on the task window become attachments. Rendered inside the window: it listens
 * on its parent element. Enter/leave are counted in the capture phase (children fire them in pairs, and
 * the editor may stop them); the drop is taken in the bubble phase, so a drop the notes editor handled
 * (it stops propagation) never reaches it.
 */
export function AttachmentDropTarget({ boardId, taskId }: { boardId: string; taskId: string }) {
  const { t } = useTranslation();
  const anchor = useRef<HTMLSpanElement>(null);
  const { addFiles } = useAttachmentUploads(boardId, taskId);
  const [state, setState] = useState<{ count: number; overEditor: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const addRef = useRef(addFiles);
  useEffect(() => {
    addRef.current = addFiles;
  }, [addFiles]);

  useEffect(() => {
    const target = anchor.current?.parentElement;
    if (!target) return;
    let depth = 0;
    const hide = () => {
      depth = 0;
      setState(null);
    };
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      const overEditor =
        dragHasImage(event.dataTransfer) &&
        Boolean((event.target as Element | null)?.closest?.(EDITOR_SELECTOR));
      const count = fileCount(event);
      setState((prev) =>
        prev && prev.count === count && prev.overEditor === overEditor ? prev : { count, overEditor },
      );
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setState(null);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (event: DragEvent) => {
      hide();
      if (!hasFiles(event)) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      setAnnouncement(t('attachments.drop.added', { count: files.length }));
      void addRef.current(files);
    };
    // Drags cannot be cancelled with Escape from the page, but the overlay can be dismissed.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || depth === 0) return;
      event.stopPropagation();
      hide();
    };
    const capture = { capture: true } as const;
    target.addEventListener('dragenter', onEnter, capture);
    target.addEventListener('dragleave', onLeave, capture);
    // Hides the overlay when a drop was handled by the notes editor (it never bubbles here).
    target.addEventListener('drop', hide, capture);
    target.addEventListener('dragover', onOver);
    target.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKey, capture);
    // A drag leaving the app window ends with `dragleave` on the root; one dropped elsewhere with `dragend`.
    window.addEventListener('dragend', hide);
    return () => {
      target.removeEventListener('dragenter', onEnter, capture);
      target.removeEventListener('dragleave', onLeave, capture);
      target.removeEventListener('drop', hide, capture);
      target.removeEventListener('dragover', onOver);
      target.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onKey, capture);
      window.removeEventListener('dragend', hide);
    };
  }, [t]);

  return (
    <>
      <span ref={anchor} hidden />
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {state && !state.overEditor && <DropOverlay count={state.count} />}
    </>
  );
}
