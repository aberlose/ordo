import { CornerDownLeft, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Kbd } from '@renderer/shared/ui/kbd';

export interface QuickAddProps {
  open: boolean;
  /** Changes on every open request: the field takes the focus again. */
  focusRequest?: number;
  onOpen: () => void;
  onClose: () => void;
  /** Called with the typed title; the field stays open for the next task. */
  onSubmit: (title: string) => void;
}

/** Approved mockup: tasks/QuickAdd variant B — the "Add" link turns into a one-line field. */
export function QuickAdd({ open, focusRequest = 0, onOpen, onClose, onSubmit }: QuickAddProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open, focusRequest]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-8.5 items-center gap-1.5 rounded-md px-1 text-meta text-text-3 hover:text-text-2"
      >
        <Plus size={14} aria-hidden />
        {t('column.add')}
      </button>
    );
  }

  const submit = () => {
    if (title.trim() === '') return;
    onSubmit(title);
    setTitle('');
    input.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex h-9.5 items-center gap-2 rounded-card border-strong border-border-strong bg-surface pr-2 pl-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
        <Plus size={14} className="shrink-0 text-text-3" aria-hidden />
        <input
          ref={input}
          value={title}
          aria-label={t('task.newTitle')}
          placeholder={t('task.newTitlePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setTitle('');
              onClose();
            }
          }}
          onBlur={() => {
            if (title.trim() === '') onClose();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-3"
        />
        <Kbd aria-hidden>
          <CornerDownLeft size={11} />
        </Kbd>
      </label>
      <span className="px-1 text-small text-text-3">
        <Trans i18nKey="task.quickAddHint" components={{ kbd: <Kbd /> }} />
      </span>
    </div>
  );
}
