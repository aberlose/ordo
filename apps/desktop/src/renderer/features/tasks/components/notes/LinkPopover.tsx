import { ExternalLink, Link2, Pencil, Unlink } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { isMac } from '@renderer/shared/lib/platform';
import { Button } from '@renderer/shared/ui/button';
import { linkLabel, normalizeLink } from './helpers';

export interface LinkPopoverProps {
  /** The current address (editing a link), `''` for a new one. */
  initial: string;
  style: CSSProperties;
  /** A valid, normalised address; `null` when the field was emptied (removes the link). */
  onApply: (href: string | null) => void;
  /** Escape: closed, the focus goes back to the text. */
  onCancel: () => void;
  /** A pointer down outside it, or the focus moved elsewhere: closed, nothing applied. */
  onDismiss: () => void;
  /** Stories: shown as after an invalid address was applied. */
  defaultInvalid?: boolean;
  /** Stories: the address typed so far. */
  defaultValue?: string;
}

/**
 * The small window under the selection (approved mockup: notes-attachments/NoteLinks A): the address,
 * Enter applies, Escape cancels. "exemple.fr" becomes https://exemple.fr; only http, https and mailto.
 */
export function LinkPopover({
  initial,
  style,
  onApply,
  onCancel,
  onDismiss,
  defaultInvalid = false,
  defaultValue,
}: LinkPopoverProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue ?? initial);
  const [invalid, setInvalid] = useState(defaultInvalid);
  const hintId = useId();
  const root = useRef<HTMLElement>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  // A pointer down anywhere else closes it (a click in the text, the toolbar, another field…).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node | null)) dismiss.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

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
      ref={root}
      role="dialog"
      aria-label={t('notes.link.dialog')}
      data-escape-local
      style={style}
      onBlur={(event) => {
        // The focus left for another element (not the app losing the focus to another window).
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) onDismiss();
      }}
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
          placeholder={t('notes.link.placeholder')}
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
  /** Escape with the focus in the bubble: back to the text. */
  onEscape?: () => void;
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
  onEscape,
}: LinkBubbleProps) {
  const { t } = useTranslation();
  const label = linkLabel(href);
  // ⌥/Alt + Enter in the text opens the link too: said in the Ouvrir tooltip.
  const openTitle = t('notes.toolbar.withShortcut', {
    label: t('notes.link.open'),
    shortcut: isMac() ? '⌥↵' : t('notes.link.altEnter'),
  });
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
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !onEscape) return;
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      }}
      className="absolute z-20 flex items-center gap-1 rounded-popover border border-border bg-surface py-1 pr-1 pl-2.5 text-text shadow-pop"
    >
      <span title={href} className="max-w-bubble-label truncate text-label text-text-2">
        {label}
      </span>
      <button
        type="button"
        className={bubbleButton}
        aria-label={t('notes.link.open')}
        aria-keyshortcuts="Alt+Enter"
        title={openTitle}
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
