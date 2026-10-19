import { ExternalLink, Link2, Pencil, Unlink } from 'lucide-react';
import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { linkLabel, normalizeLink } from './helpers';

export interface LinkPopoverProps {
  /** The current address (editing a link), `''` for a new one. */
  initial: string;
  style: CSSProperties;
  /** A valid, normalised address; `null` when the field was emptied (removes the link). */
  onApply: (href: string | null) => void;
  onCancel: () => void;
}

/**
 * The small window under the selection (approved mockup: notes-attachments/NoteLinks A): the address,
 * Enter applies, Escape cancels. "exemple.fr" becomes https://exemple.fr; only http, https and mailto.
 */
export function LinkPopover({ initial, style, onApply, onCancel }: LinkPopoverProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();

  const apply = () => {
    if (value.trim() === '') return onApply(null);
    const href = normalizeLink(value);
    if (!href) return setInvalid(true);
    onApply(href);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      apply();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <section
      role="dialog"
      aria-label={t('notes.link.dialog')}
      data-escape-local
      style={style}
      className="absolute z-20 flex w-popover flex-col gap-2 rounded-popover border border-border bg-surface p-2.5 text-text shadow-pop"
    >
      <label
        className={cn(
          'flex h-8.5 items-center gap-2 rounded-lg border-strong bg-surface px-2.5 ring-3',
          invalid ? 'border-danger ring-danger-soft' : 'border-accent ring-accent-soft',
        )}
      >
        <Link2 size={14} className="shrink-0 text-text-3" aria-hidden />
        <input
          autoFocus
          aria-label={t('notes.link.address')}
          aria-invalid={invalid}
          aria-describedby={hintId}
          value={value}
          placeholder="https://"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-input outline-none"
        />
      </label>
      <div className="flex items-center gap-2">
        <span id={hintId} className={cn('flex-1 text-small', invalid ? 'text-danger' : 'text-text-3')}>
          {t(invalid ? 'notes.link.invalid' : 'notes.link.hint')}
        </span>
        <Button variant="primary" onClick={apply} className="h-7 px-3.5 font-semibold">
          {t('notes.link.apply')}
        </Button>
      </div>
    </section>
  );
}

export interface LinkBubbleProps {
  href: string;
  style: CSSProperties;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocusChange?: (inside: boolean) => void;
}

const bubbleButton = 'flex size-7 items-center justify-center rounded-lg text-text-2 hover:bg-rail';

/** The bubble on a hovered or focused link (NoteLinks A): its address, Ouvrir, Modifier, Retirer. */
export function LinkBubble({
  href,
  style,
  onOpen,
  onEdit,
  onRemove,
  onPointerEnter,
  onPointerLeave,
  onFocusChange,
}: LinkBubbleProps) {
  const { t } = useTranslation();
  const label = linkLabel(href);
  return (
    <div
      role="dialog"
      aria-label={t('notes.link.bubble', { label })}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => onFocusChange?.(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFocusChange?.(false);
      }}
      onMouseDown={(event) => event.preventDefault()}
      className="absolute z-20 flex items-center gap-1 rounded-popover border border-border bg-surface py-1 pr-1 pl-2.5 text-text shadow-pop"
    >
      <span title={href} className="max-w-42.5 truncate text-label text-text-2">
        {label}
      </span>
      <button
        type="button"
        className={bubbleButton}
        aria-label={t('notes.link.open')}
        title={t('notes.link.open')}
        onClick={onOpen}
      >
        <ExternalLink size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={bubbleButton}
        aria-label={t('notes.link.edit')}
        title={t('notes.link.edit')}
        onClick={onEdit}
      >
        <Pencil size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={bubbleButton}
        aria-label={t('notes.link.remove')}
        title={t('notes.link.remove')}
        onClick={onRemove}
      >
        <Unlink size={14} aria-hidden />
      </button>
    </div>
  );
}
