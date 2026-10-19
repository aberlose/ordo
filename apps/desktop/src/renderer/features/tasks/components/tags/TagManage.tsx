import type { Tag } from '@ordo/contracts';
import {
  COLUMN_COLORS,
  isSameTagName,
  normalizeTagName,
  TAG_NAME_MAX_LENGTH,
  type ColumnColor,
} from '@ordo/domain';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { radioGroupKeyDown } from '@renderer/shared/ui/radio-group-keys';

export interface TagManageProps {
  tag: Tag;
  /** The board's other tags: a name already used is refused in the field. */
  tags: readonly Tag[];
  titleId: string;
  onBack: () => void;
  /** Saves a new name; `onConflict` runs if the main process finds it already used. */
  onRename: (name: string, onConflict: () => void) => void;
  onRecolor: (color: ColumnColor) => void;
  onDelete: () => void;
  /** Opens on the delete confirmation (stories). */
  defaultConfirming?: boolean | undefined;
  /** Opens with this name typed and refused as already used (stories). */
  defaultConflict?: string | undefined;
}

/**
 * "Modifier le tag" page of the tag picker (approved mockup tags-subtasks/TagManage A): back ‹, name
 * (Enter or leaving the field saves), the 10 colours (applied at once), and "Supprimer le tag" whose
 * confirmation replaces the footer, as for a column.
 */
export function TagManage({
  tag,
  tags,
  titleId,
  onBack,
  onRename,
  onRecolor,
  onDelete,
  defaultConfirming = false,
  defaultConflict,
}: TagManageProps) {
  const { t } = useTranslation();
  const ids = useId();
  const [draft, setDraft] = useState(defaultConflict ?? tag.name);
  /** The name refused as already used, shown under the field until it changes. */
  const [conflict, setConflict] = useState<string | null>(defaultConflict ?? null);
  const [confirming, setConfirming] = useState(defaultConfirming);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const refocusDelete = useRef(false);
  useEffect(() => {
    if (confirming || !refocusDelete.current) return;
    refocusDelete.current = false;
    deleteRef.current?.focus();
  }, [confirming]);

  const commit = () => {
    const name = normalizeTagName(draft);
    if (name === '') {
      setDraft(tag.name);
      setConflict(null);
      return;
    }
    if (name === tag.name) return;
    if (tags.some((other) => other.id !== tag.id && isSameTagName(other.name, name))) {
      setConflict(name);
      return;
    }
    setConflict(null);
    setDraft(name);
    onRename(name, () => setConflict(name));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commit();
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
        <button
          type="button"
          aria-label={t('tags.edit.back')}
          onClick={onBack}
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-2 hover:bg-rail"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <h2 id={titleId} className="m-0 text-input font-semibold">
          {t('tags.edit.title')}
        </h2>
      </div>

      {/* While the delete confirmation shows, the tag cannot be changed. */}
      <div inert={confirming} className={cn('flex flex-col gap-3.5 px-3.5 py-3', confirming && 'opacity-50')}>
        <label className="block">
          <span className="mb-1.5 block text-small font-semibold text-text-2">{t('tags.edit.name')}</span>
          <span
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border-strong border-border-strong bg-surface px-2.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft',
              conflict !== null && 'border-danger focus-within:border-danger',
            )}
          >
            <span
              aria-hidden
              className="h-3.25 w-0.75 shrink-0 rounded-xs"
              style={{ background: columnColorVar(tag.color) }}
            />
            <input
              // The page opens on the name, as in the mockup.
              autoFocus
              value={draft}
              maxLength={TAG_NAME_MAX_LENGTH}
              aria-invalid={conflict !== null || undefined}
              aria-describedby={conflict !== null ? `${ids}-conflict` : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setConflict(null);
              }}
              onBlur={commit}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 border-0 bg-transparent text-input outline-none"
            />
          </span>
          {conflict !== null && (
            <span id={`${ids}-conflict`} role="alert" className="mt-1.5 block text-small text-danger">
              {t('tags.edit.conflict', { name: conflict })}
            </span>
          )}
        </label>

        <div>
          <span id={`${ids}-color`} className="mb-1.5 block text-small font-semibold text-text-2">
            {t('tags.edit.color')}
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${ids}-color`}
            onKeyDown={(event) => radioGroupKeyDown(event)}
            className="flex flex-wrap gap-1.5"
          >
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === tag.color}
                aria-label={t(`colors.${c}`)}
                title={t(`colors.${c}`)}
                tabIndex={c === tag.color ? 0 : -1}
                onClick={() => c !== tag.color && onRecolor(c)}
                // Selected: a ring in the colour (`currentColor`) past a surface gap; keyboard focus: the
                // accent outline around it.
                className={cn(
                  'size-5 cursor-pointer rounded-full bg-current outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent',
                  c === tag.color && 'ring-2 ring-current ring-offset-2 ring-offset-surface',
                )}
                style={{ color: columnColorVar(c) }}
              />
            ))}
          </div>
        </div>

        <span className="text-small leading-snug text-text-3">{t('tags.edit.hint')}</span>
      </div>

      {confirming ? (
        <div
          role="alertdialog"
          aria-label={t('tags.edit.deleteTitle')}
          aria-describedby={`${ids}-confirm`}
          className="flex flex-col gap-2.5 border-t border-danger-line bg-danger-soft px-3.5 py-3"
        >
          <span id={`${ids}-confirm`} className="text-meta leading-snug">
            {t('tags.edit.deleteConfirm', { name: tag.name, count: tag.taskCount })}
          </span>
          <div className="flex justify-end gap-2">
            {/* The safe choice takes the focus. */}
            <Button
              autoFocus
              onClick={() => {
                refocusDelete.current = true;
                setConfirming(false);
              }}
            >
              {t('tags.edit.cancel')}
            </Button>
            <Button variant="danger" onClick={onDelete}>
              {t('tags.edit.confirm')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center border-t border-border px-3.5 py-2.5">
          <Button
            ref={deleteRef}
            variant="ghost"
            onClick={() => setConfirming(true)}
            className="-ml-1.5 px-1.5 text-danger hover:bg-danger-soft"
          >
            <Trash2 size={14} aria-hidden />
            {t('tags.edit.delete')}
          </Button>
          <span className="flex-1" />
          <span className="text-small text-text-3">{t('tags.edit.count', { count: tag.taskCount })}</span>
        </div>
      )}
    </>
  );
}
