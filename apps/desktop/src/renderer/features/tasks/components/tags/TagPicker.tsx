import type { Tag } from '@ordo/contracts';
import { canCreateTag, matchTags, newTagColor, normalizeTagName } from '@ordo/domain';
import { Check, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Kbd } from '@renderer/shared/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/shared/ui/popover';
import {
  isConflict,
  isTempTag,
  nextTempTagId,
  useCreateTag,
  useDeleteTag,
  useToggleTag,
  useUpdateTag,
} from '../../hooks/tags';
import { TagChip } from './TagChip';
import { TagManage } from './TagManage';

export interface TagPickerProps {
  boardId: string;
  taskId: string;
  /** The task's tags. */
  selectedIds: readonly string[];
  /** The board's tags, alphabetical. */
  tags: readonly Tag[];
  /** The dashed "+" the popover hangs from. */
  trigger: ReactElement;
  /** Initial state (stories, tests). */
  defaultOpen?: boolean;
  defaultQuery?: string;
  defaultManageId?: string;
  defaultConfirming?: boolean;
  defaultConflict?: string;
}

type Option = { kind: 'tag'; tag: Tag } | { kind: 'create'; name: string };

/**
 * Tags of a task in a 300 px popover under the "+" of the detail properties (approved mockups
 * tags-subtasks/TagPicker A and TagManage A): search or create, toggle without closing, ⋯ to manage.
 */
export function TagPicker({ trigger, defaultOpen = false, ...props }: TagPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/* Mounted each time it opens: starts on the list with an empty search. */}
      <TagPickerPanel {...props} />
    </Popover>
  );
}

function TagPickerPanel({
  boardId,
  taskId,
  selectedIds,
  tags,
  defaultQuery = '',
  defaultManageId,
  defaultConfirming,
  defaultConflict,
}: Omit<TagPickerProps, 'trigger' | 'defaultOpen'>) {
  const { t } = useTranslation();
  const ids = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [active, setActive] = useState(0);
  const [manageId, setManageId] = useState<string | null>(defaultManageId ?? null);
  /** Escape on the manage page: back to the list without saving the name being typed. */
  const discarding = useRef(false);
  const toggle = useToggleTag(boardId);
  const create = useCreateTag(boardId);
  const update = useUpdateTag(boardId);
  const remove = useDeleteTag(boardId);

  const managed = manageId ? tags.find((tag) => tag.id === manageId) : undefined;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const options = useMemo<Option[]>(() => {
    const matches: Option[] = matchTags(tags, query).map((tag) => ({ kind: 'tag', tag }));
    return canCreateTag(tags, query)
      ? [...matches, { kind: 'create', name: normalizeTagName(query) }]
      : matches;
  }, [tags, query]);
  const current = Math.min(active, options.length - 1);
  const optionId = (option: Option) =>
    option.kind === 'tag' ? `${ids}-tag-${option.tag.id}` : `${ids}-create`;
  const activeOption = options[current];

  // Keep the active option in view while moving with ↑↓.
  useEffect(() => {
    if (activeOption) document.getElementById(optionId(activeOption))?.scrollIntoView?.({ block: 'nearest' });
  });

  const choose = (option: Option) => {
    if (option.kind === 'create') {
      create.mutate({ tempId: nextTempTagId(), name: option.name, taskId });
      setQuery('');
      setActive(0);
      return;
    }
    if (isTempTag(option.tag.id)) return;
    toggle.mutate({ taskId, tagId: option.tag.id, on: !selected.has(option.tag.id) });
  };

  const manage = (tagId: string) => {
    discarding.current = false;
    setManageId(tagId);
  };

  const back = (tagId: string | null) => {
    setManageId(null);
    // The list comes back with the managed tag active (it may have moved after a rename).
    const index = tagId ? matchTags(tags, query).findIndex((tag) => tag.id === tagId) : -1;
    setActive(Math.max(0, index));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeOption) choose(activeOption);
    } else if (event.key === 'ArrowRight' && !event.shiftKey) {
      // → at the end of the query opens the active tag's page (the ⋯ inside an option is not read).
      const input = event.currentTarget;
      const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      if (atEnd && activeOption?.kind === 'tag' && !isTempTag(activeOption.tag.id)) {
        event.preventDefault();
        manage(activeOption.tag.id);
      }
    }
  };

  return (
    <PopoverContent
      align="center"
      {...(managed ? { 'aria-labelledby': `${ids}-title` } : { 'aria-label': t('tags.taskTags') })}
      ref={contentRef}
      // On the manage page, Escape goes back to the list (the name being typed is dropped); on the list it closes.
      onEscapeKeyDown={(event) => {
        if (!managed) return;
        event.preventDefault();
        discarding.current = true;
        back(managed.id);
      }}
      // The search field (or the tag's name) takes the focus. It is moved here, once the popover's focus
      // scope is mounted: an autoFocus alone runs earlier and the detail window's focus trap takes it back.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        contentRef.current?.querySelector<HTMLElement>('input')?.focus();
      }}
      className="flex max-h-(--radix-popover-content-available-height) w-popover-xs flex-col rounded-popover"
    >
      {managed ? (
        <TagManage
          key={managed.id}
          tag={managed}
          tags={tags}
          titleId={`${ids}-title`}
          defaultConfirming={defaultConfirming}
          defaultConflict={defaultConflict}
          onBack={() => back(managed.id)}
          onRename={(name, onConflict) => {
            // The field may blur as the page leaves after Escape: that is not a save.
            if (discarding.current) return;
            update.mutate(
              { id: managed.id, name },
              { onError: (error) => isConflict(error) && onConflict() },
            );
          }}
          onRecolor={(color) => update.mutate({ id: managed.id, color })}
          onDelete={() => {
            remove.mutate(managed.id);
            back(null);
          }}
        />
      ) : (
        <>
          <div className="px-2.5 pt-2.5 pb-1.5">
            <label className="flex h-9 items-center gap-2 rounded-lg border-strong border-border-strong bg-surface px-2.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
              <Search size={14} className="shrink-0 text-text-3" aria-hidden />
              <input
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls={`${ids}-list`}
                aria-autocomplete="list"
                aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
                aria-label={t('tags.search')}
                aria-keyshortcuts="ArrowRight"
                aria-describedby={`${ids}-manage-hint`}
                placeholder={t('tags.search')}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="min-w-0 flex-1 border-0 bg-transparent text-input outline-none placeholder:text-text-3"
              />
            </label>
            <span id={`${ids}-manage-hint`} className="sr-only">
              {t('tags.manageHint')}
            </span>
          </div>

          <div
            id={`${ids}-list`}
            role="listbox"
            aria-multiselectable
            aria-label={t('tags.boardTags')}
            className="flex max-h-72 min-h-0 flex-col gap-px overflow-y-auto px-1.5 pt-0.5 pb-1.5"
          >
            {options.map((option, index) =>
              option.kind === 'create' ? (
                <div
                  key="create"
                  id={optionId(option)}
                  role="option"
                  aria-selected={false}
                  onMouseEnter={() => setActive(index)}
                  // The focus stays in the search field.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 text-body',
                    index === current && 'bg-rail',
                  )}
                >
                  <Plus size={15} strokeWidth={2.2} className="shrink-0 text-accent" aria-hidden />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="sr-only">{t('tags.createOption', { name: option.name })}</span>
                      <span aria-hidden>{t('tags.create')}</span>
                      <TagChip aria-hidden truncate name={option.name} color={nextColor(tags)} />
                    </span>
                    <span className="text-caption text-text-3">{t('tags.createHint')}</span>
                  </span>
                </div>
              ) : (
                <TagOption
                  key={option.tag.id}
                  id={optionId(option)}
                  tag={option.tag}
                  checked={selected.has(option.tag.id)}
                  active={index === current}
                  onHover={() => setActive(index)}
                  onChoose={() => choose(option)}
                  onManage={() => manage(option.tag.id)}
                />
              ),
            )}
            {/* Any non-empty query matches a tag or offers "Créer « … »": only an empty board is empty. */}
            {options.length === 0 && (
              <span className="px-2 py-2 text-small leading-snug text-text-3">{t('tags.empty')}</span>
            )}
          </div>

          <div className="flex gap-3 border-t border-border px-3 py-2 text-caption text-text-3">
            {(['move', 'toggle', 'close'] as const).map((key) => (
              <span key={key}>
                <Trans i18nKey={`tags.keys.${key}`} components={{ kbd: <Kbd /> }} />
              </span>
            ))}
          </div>
        </>
      )}
    </PopoverContent>
  );
}

/** The colour the next created tag takes, as the main process will pick it (see useCreateTag). */
const nextColor = (tags: readonly Tag[]) => newTagColor(tags.map((tag) => tag.color));

function TagOption({
  id,
  tag,
  checked,
  active,
  onHover,
  onChoose,
  onManage,
}: {
  id: string;
  tag: Tag;
  checked: boolean;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
  onManage: () => void;
}) {
  const { t } = useTranslation();
  const pending = isTempTag(tag.id);
  /** A ⋯ reached with Tab stays while the mouse makes another option active (else the focus would drop). */
  const [focused, setFocused] = useState(false);
  return (
    <div
      id={id}
      role="option"
      aria-selected={checked}
      aria-disabled={pending || undefined}
      onMouseEnter={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      className={cn(
        'flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 text-body',
        active && 'bg-rail',
        pending && 'cursor-progress',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border-strong border-border-strong',
          checked && 'border-accent bg-accent',
        )}
      >
        {checked && <Check size={11} strokeWidth={3.4} className="text-accent-fg" />}
      </span>
      <TagChip name={tag.name} color={tag.color} truncate />
      <span className="flex-1" />
      {/* On hover or keyboard focus of the option, ⋯ replaces the count (Tab from the search reaches it). */}
      {(active || focused) && !pending ? (
        <button
          type="button"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={t('tags.manage', { name: tag.name })}
          title={t('tags.manage', { name: tag.name })}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onManage();
          }}
          className="-mr-1 flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-2 hover:bg-surface"
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      ) : (
        <span className="text-small text-text-3 tabular-nums">
          <span aria-hidden>{tag.taskCount}</span>
          <span className="sr-only">{t('tags.taskCount', { count: tag.taskCount })}</span>
        </span>
      )}
    </div>
  );
}
