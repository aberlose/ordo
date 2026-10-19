import { RotateCcw, TriangleAlert, X } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { badgeClass, TileBadge, tileClass } from './AttachmentTile';
import type { Upload } from './uploads';

/** An indeterminate bar: the copy reports no percentage (user decision for lot 6). */
function IndeterminateBar() {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = bar.current;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.animate(
      [{ transform: 'translateX(-100%)' }, { transform: 'translateX(250%)' }],
      { duration: 1400, iterations: Infinity, easing: 'ease-in-out' },
    );
    return () => animation.cancel();
  }, []);
  return (
    <span className="h-1 flex-1 overflow-hidden rounded-full bg-rail" aria-hidden>
      <span ref={bar} className="block h-1 w-2/5 rounded-full bg-accent" />
    </span>
  );
}

export interface UploadTileProps {
  upload: Upload;
  onRetry: (upload: Upload) => void;
  onDismiss: (upload: Upload) => void;
}

const iconButton = 'flex size-6.5 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-rail';

/**
 * Approved mockup: notes-attachments/Attachments A, "Copie en cours · échec": a copying file shows a
 * progress bar and "Copie…"; a failed copy stays as a red tile with Réessayer and ×.
 */
export const UploadTile = memo(function UploadTile({ upload, onRetry, onDismiss }: UploadTileProps) {
  const { t } = useTranslation();
  const failed = upload.status === 'failed';
  return (
    <li
      className={cn(tileClass, 'list-none', failed && 'border-danger')}
      data-upload-id={upload.id}
      aria-busy={!failed || undefined}
    >
      {failed ? (
        <span className={cn(badgeClass, 'bg-danger/10 text-danger')} aria-hidden>
          <TriangleAlert size={16} />
        </span>
      ) : (
        <TileBadge fileName={upload.fileName} mimeType={null} url="" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-meta font-medium text-text">{upload.fileName}</span>
        {failed ? (
          <span className="text-caption text-danger">{t('attachments.failed')}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <IndeterminateBar />
            <span className="shrink-0 text-caption text-text-3">{t('attachments.copying')}</span>
          </span>
        )}
      </span>
      {failed && (
        <>
          <button
            type="button"
            className={iconButton}
            aria-label={t('attachments.retry', { name: upload.fileName })}
            title={t('feedback.retry')}
            onClick={() => onRetry(upload)}
          >
            <RotateCcw size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={t('attachments.dismiss', { name: upload.fileName })}
            title={t('attachments.dismissShort')}
            onClick={() => onDismiss(upload)}
          >
            <X size={14} aria-hidden />
          </button>
        </>
      )}
    </li>
  );
});
