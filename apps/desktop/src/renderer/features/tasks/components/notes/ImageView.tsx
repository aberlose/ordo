import { clampImageWidth } from '@ordo/domain';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { ImageOff } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { useAttachments } from '../../hooks/attachments';
import { useNotesContext } from './context';
import { dragImageWidth } from './helpers';

type Side = 'left' | 'right';

/**
 * An image of the notes (approved mockup: notes-attachments/NoteBlocks B): its attachment's file at
 * `width` % of the note. Selected, it shows two handles (drag) — ← / → resize it by 5 % from the
 * keyboard (see `NoteImage`). An attachment deleted from the task leaves the dashed "Image supprimée"
 * box (NoteBlocks A), which Delete removes from the note.
 */
export function ImageView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const { t } = useTranslation();
  const { taskId, imageUrl } = useNotesContext();
  const attachments = useAttachments(taskId);
  const id = node.attrs['attachmentId'] as string | null;
  const width = clampImageWidth(Number(node.attrs['width']));
  const attachment = attachments.data?.find((a) => a.id === id);
  const [broken, setBroken] = useState<string | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const missing = !id || broken === id || (attachments.data !== undefined && !attachment);
  const shown = dragWidth ?? width;

  const startResize = (side: Side) => (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const container = frame.current?.parentElement?.getBoundingClientRect().width ?? 0;
    const startX = event.clientX;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let latest = width;
    const move = (e: globalThis.PointerEvent) => {
      latest = dragImageWidth(width, e.clientX - startX, container, side);
      setDragWidth(latest);
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      setDragWidth(null);
      if (latest !== width) updateAttributes({ width: latest });
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  };

  if (missing) {
    return (
      <NodeViewWrapper className="notes-image" data-drag-handle>
        <div
          role="img"
          aria-label={t('notes.image.deletedLabel')}
          className={cn(
            'flex h-22.5 items-center justify-center gap-2 rounded-lg border-strong border-dashed border-border-strong text-meta text-text-3',
            selected && 'outline-2 outline-offset-2 outline-accent',
          )}
        >
          <ImageOff size={16} aria-hidden />
          {t('notes.image.deleted')}
        </div>
      </NodeViewWrapper>
    );
  }

  const handle = (side: Side) => (
    <span
      aria-hidden
      data-resize-handle={side}
      onPointerDown={startResize(side)}
      className={cn(
        'absolute top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-sm border-2 border-surface bg-accent',
        side === 'left' ? '-left-1.25' : '-right-1.25',
      )}
    />
  );

  return (
    <NodeViewWrapper className="notes-image" data-drag-handle>
      <div ref={frame} className="relative" style={{ width: `${shown}%` }}>
        <img
          src={imageUrl(id)}
          alt={attachment?.fileName ?? ''}
          draggable={false}
          onError={() => setBroken(id)}
          className={cn('block w-full rounded-lg', selected && 'outline-2 outline-offset-2 outline-accent')}
        />
        {selected && (
          <>
            {handle('left')}
            {handle('right')}
          </>
        )}
      </div>
      {selected && (
        <span className="mt-1.5 block text-small text-text-3" contentEditable={false}>
          {t('notes.image.resizeHint', { width: shown })}
        </span>
      )}
    </NodeViewWrapper>
  );
}
