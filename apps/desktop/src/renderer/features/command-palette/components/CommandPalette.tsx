import type { BoardSummary } from '@ordo/contracts';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Command } from 'cmdk';
import {
  Columns2,
  FileText,
  Filter,
  Moon,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  SquareKanban,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useBoards } from '@renderer/features/boards';
import { searchActions } from '@renderer/features/search';
import { useTaskUi } from '@renderer/features/tasks';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { useLayout } from '@renderer/shared/layout/store';
import { today as todayDay } from '@renderer/shared/lib/dates';
import { isMac, shiftKey } from '@renderer/shared/lib/platform';
import { useNow } from '@renderer/shared/lib/useNow';
import { ColumnIcon } from '@renderer/shared/ui/column-icon';
import { Kbd } from '@renderer/shared/ui/kbd';
import { toggleTheme } from '../hooks/useGlobalShortcuts';
import { usePaletteBoard, usePaletteSearch, type PaletteSearch } from '../hooks/usePaletteSearch';
import { useRecentTasks } from '../hooks/useRecentOpens';
import {
  completeTag,
  dueChip,
  fromHit,
  GROUP_MAX_ROWS,
  highlightWords,
  priorityChip,
  type PaletteTask,
} from '../model';
import { CommandRow, GROUP, GroupNote, MoreRow, TagRow, TaskRow, TaskTitle } from './rows';

const APPLY = 'cmd:apply';
const NEW_TASK = 'cmd:new-task';
const modLabel = () => (isMac() ? '⌘' : 'Ctrl');

export interface PaletteProps {
  open: boolean;
  /** Query the palette opens with. */
  initialQuery?: string;
  onClose: () => void;
  /** The board shown behind the palette, if any. */
  boardId: string | undefined;
  /** Shows another board (navigation); a task found there opens once it resolves. */
  onShowBoard: (boardId: string) => Promise<unknown> | void;
}

/**
 * The command palette (approved mockups: command-palette for the empty query, board for the typed
 * filters, search-palette A for the results): 640 px, 96 px from the top over the dimmed app, its list
 * scrolling to keep 48 px from the bottom.
 */
export function Palette({ open, initialQuery = '', onClose, boardId, onShowBoard }: PaletteProps) {
  const { t } = useTranslation();
  // Run once the palette has closed and instead of giving the focus back (quick add, a task's window,
  // the new board popover take it themselves).
  const afterClose = useRef<(() => void) | null>(null);
  const closeThen = (run: () => void) => {
    afterClose.current = run;
    onClose();
  };
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const run = afterClose.current;
            afterClose.current = null;
            if (!run) return;
            event.preventDefault();
            run();
          }}
          // The content spans the window so the palette can keep its margins. Radix sees a click around
          // the palette as inside its content (it forces `pointer-events: auto` on it), so the empty
          // area closes the palette itself, as a click on the dimmed app would.
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex flex-col items-center pt-24 pb-12 outline-none"
        >
          <Dialog.Title className="sr-only">{t('palette.title')}</Dialog.Title>
          <PaletteBody
            initialQuery={initialQuery}
            boardId={boardId}
            onShowBoard={onShowBoard}
            close={onClose}
            closeThen={closeThen}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface BodyProps {
  initialQuery: string;
  boardId: string | undefined;
  onShowBoard: PaletteProps['onShowBoard'];
  close: () => void;
  closeThen: (run: () => void) => void;
}

/** Mounted while the palette is open: its query starts afresh each time. */
function PaletteBody({ initialQuery, boardId, onShowBoard, close, closeThen }: BodyProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const typed = query.trim() !== '';
  const { data: boards = [] } = useBoards();
  const boardQuery = usePaletteBoard(boardId);
  const board = boardId !== undefined && boardQuery.data?.id === boardId ? boardQuery.data : undefined;
  const today = todayDay(new Date(useNow()));
  const search = usePaletteSearch(query, board, today, boardId !== undefined);
  const recent = useRecentTasks();
  const sidebarCollapsed = useLayout((state) => state.sidebarCollapsed);
  const { openTask, openQuickAdd } = useTaskUi(
    useShallow((state) => ({ openTask: state.openTask, openQuickAdd: state.openQuickAdd })),
  );
  const firstColumnId = board?.columns[0]?.id;

  // The board behind shows the typed filters live; back to its own filters when the palette closes.
  const { filters } = search;
  useEffect(() => {
    if (board && typed) searchActions().setPreview(board.id, filters);
    else searchActions().clearPreview();
  }, [board, typed, filters]);
  useEffect(() => () => searchActions().clearPreview(), []);

  // Selection: "Nouvelle tâche" on an empty query (mockup command-palette), "Appliquer comme filtres
  // du board" once something is typed (search-palette A). cmdk moves the selection to the first row
  // whenever the query or the rows change: until the user moves it (↑↓, mouse), it stays on the default.
  const defaultValue = defaultValueFor(query, board !== undefined, firstColumnId !== undefined);
  const [value, setValue] = useState(defaultValue);
  const keepDefault = useRef(true);
  const onValueChange = (next: string) => {
    // cmdk calls the latest handler, so `defaultValue` is current.
    if (!keepDefault.current || defaultValue === '') return setValue(next);
    // cmdk has already moved its own selection: give it the default back even when our state holds it
    // (cmdk trims values, so a trailing space makes a new prop value with the same meaning).
    setValue((current) => (current === defaultValue ? `${defaultValue} ` : defaultValue));
  };
  const onQueryChange = (next: string) => {
    keepDefault.current = true;
    setQuery(next);
    setValue(defaultValueFor(next, board !== undefined, firstColumnId !== undefined));
  };
  const userMoved = () => (keepDefault.current = false);
  // The board arrives after the first render: select its default then.
  useEffect(() => {
    if (keepDefault.current && defaultValue !== '') setValue(defaultValue);
  }, [defaultValue]);

  const openFound = (task: Pick<PaletteTask, 'id' | 'boardId'>) =>
    closeThen(() => {
      const shown = task.boardId === boardId ? undefined : onShowBoard(task.boardId);
      void Promise.resolve(shown).then(() => openTask(task.id));
    });
  const newTask = () => firstColumnId && closeThen(() => openQuickAdd(firstColumnId));
  const showBoard = (id: string) => {
    close();
    void onShowBoard(id);
  };
  const words = useMemo(() => highlightWords(search.parsed.text), [search.parsed.text]);

  return (
    <Command
      shouldFilter={false}
      vimBindings={false}
      // Labels the query field (cmdk renders it as its <label>).
      label={t('palette.inputLabel')}
      value={value}
      onValueChange={onValueChange}
      onKeyDown={(event) => {
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) userMoved();
      }}
      className="pointer-events-auto flex max-h-full w-160 flex-col overflow-hidden rounded-window border border-border bg-surface text-text shadow-pop"
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4.5">
        <Search size={18} aria-hidden className="shrink-0 text-text-3" />
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          placeholder={t('palette.placeholder')}
          className="min-w-0 flex-1 border-0 bg-transparent text-palette text-text outline-none placeholder:text-text-3 focus-visible:outline-none"
        />
        <Kbd className="bg-transparent text-text-3">{t('palette.keys.esc')}</Kbd>
      </div>
      {typed && <Strip search={search} taskSelected={value.trim().startsWith('task:')} />}
      <Command.List
        label={t('palette.results')}
        onPointerMoveCapture={userMoved}
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-1.5 pb-2"
      >
        {typed ? (
          <TypedGroups
            query={query}
            search={search}
            words={words}
            hasBoard={board !== undefined}
            boardName={board?.name ?? ''}
            otherBoardsGroup={
              boardId === undefined && <BoardsGroup boards={boards} boardId={boardId} onShow={showBoard} />
            }
            canAddTask={firstColumnId !== undefined}
            onPickTag={(name) => onQueryChange(completeTag(query, name))}
            onOpen={openFound}
            onApply={() => {
              if (!board) return;
              searchActions().apply(board.id, search.filters);
              close();
            }}
            onNewTask={newTask}
          />
        ) : (
          <>
            {(recent.data?.length ?? 0) > 0 && (
              <Command.Group heading={t('palette.groups.recent')} className={GROUP}>
                {recent.data!.map((hit) => (
                  <CommandRow
                    key={hit.id}
                    value={`recent:${hit.id}`}
                    icon={<FileText size={15} />}
                    label={<TaskTitle task={fromHit(hit)} words={[]} />}
                    meta={hit.columnName}
                    onSelect={() => openFound(hit)}
                  />
                ))}
              </Command.Group>
            )}
            <Command.Group heading={t('palette.groups.actions')} className={GROUP}>
              {firstColumnId && (
                <CommandRow
                  value={NEW_TASK}
                  icon={<Plus size={15} />}
                  label={t('palette.actions.newTask')}
                  keys={['N']}
                  accent
                  onSelect={newTask}
                />
              )}
              {board && (
                <CommandRow
                  value="cmd:new-column"
                  icon={<Columns2 size={15} />}
                  label={t('palette.actions.newColumn')}
                  onSelect={() => closeThen(() => useLayout.getState().requestNewColumn())}
                />
              )}
              <CommandRow
                value="cmd:new-board"
                icon={<SquareKanban size={15} />}
                label={t('palette.actions.newBoard')}
                onSelect={() => closeThen(() => useLayout.getState().requestNewBoard())}
              />
              <CommandRow
                value="cmd:theme"
                icon={<Moon size={15} />}
                label={t('palette.actions.toggleTheme')}
                keys={isMac() ? [shiftKey(), '⌘', 'L'] : ['Ctrl', shiftKey(), 'L']}
                onSelect={() => {
                  close();
                  toggleTheme();
                }}
              />
              <CommandRow
                value="cmd:sidebar"
                icon={<PanelLeft size={15} />}
                label={t(
                  sidebarCollapsed ? 'palette.actions.expandSidebar' : 'palette.actions.collapseSidebar',
                )}
                keys={[modLabel(), '\\']}
                onSelect={() => {
                  close();
                  useLayout.getState().toggleSidebar();
                }}
              />
            </Command.Group>
            <BoardsGroup boards={boards} boardId={boardId} onShow={showBoard} />
          </>
        )}
      </Command.List>
      <footer className="flex shrink-0 items-center gap-4 border-t border-border px-4.5 py-2.5 text-small text-text-3">
        <span className="flex items-center gap-1.5">
          <Kbd className="bg-transparent text-text-3">↑</Kbd>
          <Kbd className="bg-transparent text-text-3">↓</Kbd>
          {t('palette.footer.navigate')}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd className="bg-transparent text-text-3">↵</Kbd>
          {t('palette.footer.open')}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd className="bg-transparent text-text-3">{t('palette.keys.esc')}</Kbd>
          {t('palette.footer.close')}
        </span>
        <div className="flex-1" />
        <span>
          <Trans
            i18nKey="palette.footer.syntax"
            components={{ b: <b className="font-semibold text-text-2" /> }}
          />
        </span>
      </footer>
    </Command>
  );
}

function defaultValueFor(query: string, hasBoard: boolean, canAddTask: boolean): string {
  if (query.trim() !== '') return hasBoard ? APPLY : '';
  return canAddTask ? NEW_TASK : '';
}

/** "Filtres reconnus" and "Résultat" (approved board mockup, kept by search-palette A). */
function Strip({ search, taskSelected }: { search: PaletteSearch; taskSelected: boolean }) {
  const { t } = useTranslation();
  const { parsed, tags, boardCount, filtersIgnored } = search;
  const chips = [
    priorityChip(parsed.priorities, t),
    ...(filtersIgnored ? parsed.tagNames : tags.map((tag) => tag.name)).map((name) => `#${name}`),
    ...parsed.due.map((due) => dueChip(due, t)),
    ...(parsed.text.trim() !== '' ? [t('palette.chips.text', { text: parsed.text.trim() })] : []),
  ].filter((chip): chip is string => chip !== null);
  // One sentence per variant (no concatenated suffix): plain, live, or "↵ on a task opens it".
  const countKey =
    !boardCount || boardCount.shown === 0
      ? 'palette.strip.count'
      : taskSelected
        ? 'palette.strip.countOpen'
        : 'palette.strip.countLive';
  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-rail px-4.5 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-30 shrink-0 text-small text-text-3">{t('palette.strip.recognised')}</span>
        {chips.length === 0 ? (
          <span className="text-label text-text-3">{t('palette.strip.none')}</span>
        ) : (
          chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex h-5.5 items-center rounded-md bg-accent-soft px-2 text-label text-text"
            >
              {chip}
            </span>
          ))
        )}
      </div>
      {(boardCount || filtersIgnored) && (
        <div className="flex items-center gap-1.5">
          <span className="w-30 shrink-0 text-small text-text-3">{t('palette.strip.result')}</span>
          <span className="text-label text-text-2">
            {boardCount
              ? t(countKey, { count: boardCount.shown, total: boardCount.total })
              : t('palette.strip.openBoard')}
          </span>
        </div>
      )}
    </div>
  );
}

/** "Aller au board": every board but the one shown. */
function BoardsGroup({
  boards,
  boardId,
  onShow,
}: {
  boards: readonly BoardSummary[];
  boardId: string | undefined;
  onShow: (boardId: string) => void;
}) {
  const { t } = useTranslation();
  const others = boards.filter((b) => b.id !== boardId);
  if (others.length === 0) return null;
  return (
    <Command.Group heading={t('palette.groups.boards')} className={GROUP}>
      {others.map((b) => (
        <CommandRow
          key={b.id}
          value={`board:${b.id}`}
          icon={<ColumnIcon icon={b.icon ?? 'kanban'} size={15} />}
          tint={b.color}
          label={b.name}
          meta={t('board.taskCount', { count: b.taskCount })}
          onSelect={() => onShow(b.id)}
        />
      ))}
    </Command.Group>
  );
}

interface TypedGroupsProps {
  query: string;
  search: PaletteSearch;
  words: readonly string[];
  hasBoard: boolean;
  boardName: string;
  canAddTask: boolean;
  /** "Aller au board", shown for a filter-only query when no board is (approved state). */
  otherBoardsGroup: ReactNode;
  onPickTag: (name: string) => void;
  onOpen: (task: PaletteTask) => void;
  onApply: () => void;
  onNewTask: () => void;
}

/**
 * Results of a typed query (approved mockup search-palette A, and the states approved with the lot 7
 * review): at most 6 rows per group, its header giving the total and a last grey row the rest.
 */
function TypedGroups({
  query,
  search,
  words,
  hasBoard,
  boardName,
  canAddTask,
  otherBoardsGroup,
  onPickTag,
  onOpen,
  onApply,
  onNewTask,
}: TypedGroupsProps) {
  const { t } = useTranslation();
  const { suggestions, thisBoard, otherBoards, otherTruncated, loading, error } = search;
  const withText = search.parsed.text.trim() !== '';
  const rows = (tasks: readonly PaletteTask[], showBoard: boolean): ReactNode =>
    tasks
      .slice(0, GROUP_MAX_ROWS)
      .map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          words={words}
          showBoard={showBoard}
          onSelect={() => onOpen(task)}
        />
      ));
  const more = (count: number, key: string) =>
    count > GROUP_MAX_ROWS && <MoreRow>{t(key, { count: count - GROUP_MAX_ROWS })}</MoreRow>;

  let tasks: ReactNode = null;
  if (error) {
    // Approved state: an error line and "Réessayer" (as the other load errors), the commands stay.
    tasks = (
      <Command.Group heading={t('palette.groups.tasksHeading')} className={GROUP}>
        <GroupNote role="alert">{t('palette.searchError')}</GroupNote>
        <CommandRow
          value="cmd:retry"
          icon={<RotateCcw size={15} />}
          label={t('feedback.retry')}
          onSelect={search.retry}
        />
      </Command.Group>
    );
  } else if (!withText) {
    // Filters only: the board's cards (approved state for no match), or open a board first.
    tasks = hasBoard ? (
      <Command.Group
        heading={t('palette.groups.thisBoard', { name: boardName, count: thisBoard.length })}
        className={GROUP}
      >
        {thisBoard.length === 0 ? (
          <GroupNote>{t('palette.noBoardMatch')}</GroupNote>
        ) : (
          <>
            {rows(thisBoard, false)}
            {more(thisBoard.length, 'palette.more.thisBoard')}
          </>
        )}
      </Command.Group>
    ) : (
      otherBoardsGroup
    );
  } else if (!loading && thisBoard.length === 0 && otherBoards.length === 0) {
    tasks = (
      <Command.Group heading={t('palette.groups.tasks', { count: 0 })} className={GROUP}>
        <GroupNote>{t('palette.noResult', { query: query.trim() })}</GroupNote>
      </Command.Group>
    );
  } else if (!loading) {
    const elsewhere = hasBoard ? 'palette.groups.otherBoards' : 'palette.groups.tasks';
    tasks = (
      <>
        {hasBoard && thisBoard.length > 0 && (
          <Command.Group
            heading={t('palette.groups.thisBoard', { name: boardName, count: thisBoard.length })}
            className={GROUP}
          >
            {rows(thisBoard, false)}
            {more(thisBoard.length, 'palette.more.thisBoard')}
          </Command.Group>
        )}
        <Command.Group
          heading={t(otherTruncated ? `${elsewhere}AtLeast` : elsewhere, { count: otherBoards.length })}
          className={GROUP}
        >
          {otherBoards.length === 0 ? (
            <GroupNote>{t('palette.noneElsewhere')}</GroupNote>
          ) : (
            <>
              {rows(otherBoards, true)}
              {more(
                otherBoards.length,
                otherTruncated ? 'palette.more.elsewhereAtLeast' : 'palette.more.elsewhere',
              )}
            </>
          )}
        </Command.Group>
      </>
    );
  }

  return (
    <>
      {suggestions.length > 0 && (
        <Command.Group heading={t('palette.groups.tags')} className={GROUP}>
          {suggestions.map((tag) => (
            <TagRow key={tag.id} name={tag.name} color={tag.color} onSelect={() => onPickTag(tag.name)} />
          ))}
        </Command.Group>
      )}
      {tasks}
      {hasBoard && (
        <Command.Group heading={t('palette.groups.commands')} className={GROUP}>
          <CommandRow
            value={APPLY}
            icon={<Filter size={15} />}
            label={t('palette.actions.apply')}
            keys={['↵']}
            accent
            onSelect={onApply}
          />
          {canAddTask && (
            <CommandRow
              value={NEW_TASK}
              icon={<Plus size={15} />}
              label={t('palette.actions.newTask')}
              keys={['N']}
              accent
              onSelect={onNewTask}
            />
          )}
        </Command.Group>
      )}
    </>
  );
}

/** The palette wired to the app: shown board from the route, navigation to other boards. */
export function CommandPalette() {
  const { open, initialQuery, closePalette } = usePalette(
    useShallow((state) => ({
      open: state.open,
      initialQuery: state.initialQuery,
      closePalette: state.closePalette,
    })),
  );
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  return (
    <Palette
      open={open}
      initialQuery={initialQuery}
      onClose={closePalette}
      boardId={params.boardId}
      onShowBoard={(boardId) => navigate({ to: '/boards/$boardId', params: { boardId } })}
    />
  );
}
