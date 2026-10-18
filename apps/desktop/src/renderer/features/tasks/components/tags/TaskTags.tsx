import type { Task } from '@ordo/contracts';
import { Plus, X } from 'lucide-react';
import { compareTags } from '@ordo/domain';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isTempTag, useBoardTags, useToggleTag } from '../../hooks/tags';
import { TagChip } from './TagChip';
import { TagPicker, type TagPickerProps } from './TagPicker';

const ADD = 'add';

export interface TaskTagsProps {
  boardId: string;
  task: Task;
  /** Initial picker state (stories, tests). */
  picker?: Pick<
    TagPickerProps,
    'defaultOpen' | 'defaultQuery' | 'defaultManageId' | 'defaultConfirming' | 'defaultConflict'
  >;
}

/**
 * Tags row of the detail properties (approved mockup tags-subtasks/TagPicker A): the task's chips,
 * each with a × on hover or focus (Delete or Backspace also removes it), then the dashed "+" opening
 * the picker.
 */
export function TaskTags({ boardId, task, picker }: TaskTagsProps) {
  const { t } = useTranslation();
  const tags = useBoardTags(boardId);
  const toggle = useToggleTag(boardId);
  const rowRef = useRef<HTMLDivElement>(null);
  /** After a removal, the focus goes to the next chip's ×, or the "+". */
  const focusNext = useRef<string | null>(null);
  const byId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  // Alphabetical, also right after a rename (the task's tag ids keep the order of the old names).
  const shown = task.tagIds.flatMap((id) => byId.get(id) ?? []).sort(compareTags);

  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    const selector = target === ADD ? '[data-tag-add]' : `[data-tag-remove="${target}"]`;
    rowRef.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [task.tagIds]);

  const removeAt = (index: number) => {
    const tag = shown[index];
    // A tag being created has no id on the server yet.
    if (!tag || isTempTag(tag.id)) return;
    focusNext.current = shown[index + 1]?.id ?? ADD;
    toggle.mutate({ taskId: task.id, tagId: tag.id, on: false });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeAt(index);
    }
  };

  return (
    <div ref={rowRef} className="flex min-w-0 flex-wrap items-center gap-1.5 py-1">
      {shown.map((tag, index) => (
        <TagChip
          key={tag.id}
          name={tag.name}
          color={tag.color}
          // The × shows on hover, or when it has the keyboard focus (the chip takes the ring). Its place
          // is kept at rest, so showing it does not widen the chip and push the next ones.
          className="group/chip pr-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent"
        >
          <button
            type="button"
            data-tag-remove={tag.id}
            aria-label={t('tags.remove', { name: tag.name })}
            aria-keyshortcuts="Delete Backspace"
            onClick={() => removeAt(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            // Transparent but focusable at rest, visible on hover of the chip or keyboard focus.
            className="-mr-0.75 flex cursor-pointer rounded-xs bg-rail text-text-2 opacity-0 outline-none group-hover/chip:opacity-100 focus-visible:opacity-100"
          >
            <X size={12} strokeWidth={2.4} aria-hidden />
          </button>
        </TagChip>
      ))}
      <TagPicker
        {...picker}
        boardId={boardId}
        taskId={task.id}
        selectedIds={task.tagIds}
        tags={tags}
        trigger={
          <button
            type="button"
            data-tag-add
            aria-label={t('tags.add')}
            title={t('tags.add')}
            className="flex size-5.5 cursor-pointer items-center justify-center rounded border border-dashed border-border-strong text-text-3 hover:text-text-2 data-[state=open]:bg-accent-soft data-[state=open]:text-accent"
          >
            <Plus size={12} strokeWidth={2.4} aria-hidden />
          </button>
        }
      />
    </div>
  );
}
