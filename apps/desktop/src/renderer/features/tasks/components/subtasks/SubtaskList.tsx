import type { Column, Task } from '@ordo/contracts';
import type { ColumnColor } from '@ordo/domain';
import { Plus, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar } from '@renderer/shared/ui/colors';
import { progressOf } from '../../hooks/subtasks';
import { SubtaskRow } from './SubtaskRow';

export interface SubtaskListProps {
  /** `undefined` while loading: the header only, no empty state flashing. */
  subtasks: readonly Task[] | undefined;
  columns: readonly Column[];
  /** Colour of the parent's column: the progress bar. */
  color: ColumnColor;
  /** The list could not be loaded: the empty state's dashed box with the message and a retry. */
  loadError?: boolean;
  /** Loads the list again after a load error. */
  onRetry?: () => void;
  /** Stories: the add field shown open. */
  defaultAdding?: boolean;
  /** Stories: the status menu of this sub-task shown open. */
  menuOpenId?: string;
  onToggle: (task: Task, done: boolean) => void;
  onMove: (task: Task, columnId: string) => void;
  onOpen: (task: Task) => void;
  /** Called with the typed title; the field stays open for the next sub-task. */
  onAdd: (title: string) => void;
}

/**
 * Approved mockup: tags-subtasks/SubtaskRows — variant A (header with done/total and a progress bar,
 * sober rows, "Ajouter une sous-tâche" opening a field at the bottom), empty state of variant B.
 */
export function SubtaskList({
  subtasks,
  columns,
  color,
  loadError = false,
  onRetry,
  defaultAdding = false,
  menuOpenId,
  onToggle,
  onMove,
  onOpen,
  onAdd,
}: SubtaskListProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [adding, setAdding] = useState(defaultAdding);
  const [title, setTitle] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  /** Escape gives the focus back to the button that opened the field. */
  const refocus = useRef(false);

  useEffect(() => {
    if (adding) input.current?.focus();
    else if (refocus.current) {
      refocus.current = false;
      addButton.current?.focus();
    }
  }, [adding]);

  const progress = subtasks ? progressOf(subtasks, columns) : null;
  const empty = subtasks !== undefined && subtasks.length === 0;

  const close = (focusButton: boolean) => {
    refocus.current = focusButton;
    setTitle('');
    setAdding(false);
  };
  const submit = () => {
    if (title.trim() === '') return;
    onAdd(title);
    setTitle('');
    input.current?.focus();
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <div className="mb-1.5 flex items-center gap-2.5">
        <h2 id={headingId} className="text-input font-semibold">
          {t('subtasks.title')}
        </h2>
        {progress && progress.total > 0 && (
          <>
            <span
              className="text-meta text-text-3 tabular-nums"
              aria-label={t('subtasks.progressLabel', progress)}
            >
              {t('subtasks.progress', progress)}
            </span>
            <div className="h-1 max-w-40 flex-1 overflow-hidden rounded-full bg-rail" aria-hidden>
              <div
                className="h-1 transition-[width]"
                style={{
                  width: `${(progress.done / progress.total) * 100}%`,
                  backgroundColor: columnColorVar(color),
                }}
              />
            </div>
          </>
        )}
      </div>

      {loadError ? (
        // Approved with the lot 5 review: the empty state's dashed box, with a retry (as the archives).
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-popover border-2 border-dashed border-border p-5.5 text-center"
        >
          <span className="text-meta leading-snug text-text-2">{t('subtasks.loadError')}</span>
          {onRetry && (
            <Button onClick={onRetry}>
              <RotateCcw size={14} aria-hidden />
              {t('feedback.retry')}
            </Button>
          )}
        </div>
      ) : empty && !adding ? (
        <div className="flex flex-col items-center gap-2 rounded-popover border-2 border-dashed border-border p-5.5 text-center">
          <span className="text-body font-semibold">{t('subtasks.empty')}</span>
          <span className="text-meta text-text-3">{t('subtasks.emptyHint')}</span>
          <Button ref={addButton} data-subtask-add onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden />
            {t('subtasks.add')}
          </Button>
        </div>
      ) : (
        <>
          {subtasks && subtasks.length > 0 && (
            <ul className="flex flex-col" aria-labelledby={headingId}>
              {subtasks.map((task) => (
                <SubtaskRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  menuOpen={task.id === menuOpenId}
                  onToggle={onToggle}
                  onMove={onMove}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
          {adding ? (
            <>
              <div className="flex h-9 items-center gap-2.5 px-0.5">
                <span aria-hidden className="size-4.5 shrink-0 rounded-sm border-strong border-border" />
                <label className="flex h-8 min-w-0 flex-1 items-center rounded-lg border-strong border-border-strong bg-surface px-2.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
                  <input
                    ref={input}
                    data-escape-local
                    value={title}
                    aria-label={t('subtasks.newTitle')}
                    placeholder={t('subtasks.newTitle')}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        submit();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        close(true);
                      }
                    }}
                    onBlur={() => {
                      if (title.trim() === '') close(false);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-input outline-none placeholder:text-text-3"
                  />
                </label>
              </div>
              <span className="pl-7 text-small text-text-3">{t('subtasks.addHint')}</span>
            </>
          ) : (
            <button
              ref={addButton}
              type="button"
              data-subtask-add
              onClick={() => setAdding(true)}
              className="flex h-8.5 cursor-pointer items-center gap-2.5 self-start rounded-md text-body text-text-3 hover:text-text-2"
            >
              <Plus size={16} aria-hidden />
              {t('subtasks.add')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
