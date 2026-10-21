import type { BoardDetail, Input, Tag, Task } from '@ordo/contracts';
import { compareTags, newTagColor, type ColumnColor } from '@ordo/domain';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ApiError, call } from '@renderer/shared/api/client';
import { boardKeys, taskKeys } from '@renderer/shared/api/keys';
import { useFeedback } from '@renderer/shared/feedback/store';
import i18n from '@renderer/i18n';
import { refreshSearch } from './searchCache';

/** What a card needs to draw a tag (no task count: toggling a tag elsewhere does not re-render cards). */
export interface TagLook {
  readonly id: string;
  readonly name: string;
  readonly color: ColumnColor;
}

export const TEMP_TAG_PREFIX = 'temp-tag-';
export const isTempTag = (id: string) => id.startsWith(TEMP_TAG_PREFIX);

const EMPTY_TAGS: readonly Tag[] = [];
const selectLooks = (board: BoardDetail): TagLook[] =>
  board.tags.map(({ id, name, color }) => ({ id, name, color }));
const selectTags = (board: BoardDetail): Tag[] => board.tags;

const boardQuery = (boardId: string) => ({
  queryKey: boardKeys.detail(boardId),
  queryFn: () => call('boards.get', { id: boardId }),
});

/**
 * The board's tags by id, for the cards of its columns. Structural sharing keeps the map stable
 * while names and colours do not change, so the memoised cards do not re-render on other edits.
 */
export function useTagLooks(boardId: string): ReadonlyMap<string, TagLook> {
  const { data } = useQuery({ ...boardQuery(boardId), select: selectLooks });
  return useMemo(() => new Map((data ?? []).map((tag) => [tag.id, tag])), [data]);
}

/** The board's tags with their task counts (picker). */
export function useBoardTags(boardId: string): readonly Tag[] {
  const { data } = useQuery({ ...boardQuery(boardId), select: selectTags });
  return data ?? EMPTY_TAGS;
}

type FailedAction = 'tagTask' | 'createTag' | 'updateTag' | 'deleteTag';

/** Tag edits can overlap (several quick toggles): reload the board rather than restoring a snapshot. */
function failed(client: QueryClient, boardId: string, action: FailedAction, retry: () => void) {
  void client.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
  void client.invalidateQueries({ predicate: (query) => holdsTasks(query.state.data) });
  useFeedback.getState().showToast(i18n.t(`feedback.failed.${action}`), retry);
}

const isTask = (value: unknown): value is Task =>
  typeof value === 'object' && value !== null && 'tagIds' in value && 'columnId' in value;
const holdsTasks = (data: unknown) => isTask(data) || (Array.isArray(data) && data.some(isTask));

/** Task ids in the order of their tags' names (as the main process returns them). */
const sortTagIds = (ids: readonly string[], tags: readonly Tag[]): string[] => {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  return [...ids].sort((a, b) => {
    const ta = byId.get(a);
    const tb = byId.get(b);
    return ta && tb ? compareTags(ta, tb) : 0;
  });
};

function patchBoard(client: QueryClient, boardId: string, change: (board: BoardDetail) => BoardDetail) {
  client.setQueryData<BoardDetail>(boardKeys.detail(boardId), (board) => (board ? change(board) : board));
}

/**
 * A task outside the board's top-level list (a sub-task in its window or its parent's list) is cached
 * under other keys: patch every cached task with that id.
 */
function patchCachedTasks(client: QueryClient, change: (task: Task) => Task | null) {
  client.setQueriesData<unknown>({ predicate: (query) => holdsTasks(query.state.data) }, (data: unknown) => {
    if (isTask(data)) return change(data) ?? data;
    if (!Array.isArray(data)) return undefined;
    let changed = false;
    const next = data.map((item) => {
      if (!isTask(item)) return item;
      const patched = change(item);
      if (patched === null) return item;
      changed = true;
      return patched;
    });
    return changed ? next : data;
  });
}

/** Applies `change` to the task `taskId` wherever it is cached. */
function patchTask(client: QueryClient, boardId: string, taskId: string, change: (task: Task) => Task) {
  patchBoard(client, boardId, (board) => ({
    ...board,
    tasks: board.tasks.map((t) => (t.id === taskId ? change(t) : t)),
  }));
  patchCachedTasks(client, (t) => (t.id === taskId ? change(t) : null));
}

const withTags = (board: BoardDetail, tags: Tag[]): BoardDetail => ({
  ...board,
  tags: tags.sort(compareTags),
});

/** Put a tag on a task or take it off (picker toggle, × of a chip), optimistic: the task and the tag's count. */
export function useToggleTag(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ on, ...input }: Input<'tasks.addTag'> & { on: boolean }) =>
      call(on ? 'tasks.addTag' : 'tasks.removeTag', input),
    onMutate: async ({ taskId, tagId, on }) => {
      // A sub-task is also cached in its window and in its parent's list: no refetch may overwrite the patch.
      await Promise.all([
        client.cancelQueries({ queryKey: boardKeys.detail(boardId) }),
        client.cancelQueries({ queryKey: taskKeys.detail(taskId) }),
        client.cancelQueries({ queryKey: taskKeys.allSubtasks }),
      ]);
      const tags = client.getQueryData<BoardDetail>(boardKeys.detail(boardId))?.tags ?? [];
      let delta = 0;
      patchTask(client, boardId, taskId, (task) => {
        const has = task.tagIds.includes(tagId);
        if (has === on) return task;
        delta = on ? 1 : -1;
        const tagIds = on
          ? sortTagIds([...task.tagIds, tagId], tags)
          : task.tagIds.filter((id) => id !== tagId);
        return { ...task, tagIds };
      });
      if (delta !== 0) {
        patchBoard(client, boardId, (board) => ({
          ...board,
          tags: board.tags.map((tag) =>
            tag.id === tagId ? { ...tag, taskCount: Math.max(0, tag.taskCount + delta) } : tag,
          ),
        }));
      }
    },
    onSuccess: (task) =>
      patchTask(client, boardId, task.id, (cached) => ({ ...cached, tagIds: task.tagIds })),
    onError: (_error, input) => failed(client, boardId, 'tagTask', () => mutation.mutate(input)),
    // Tag names are searched.
    onSettled: () => refreshSearch(client),
  });
  return mutation;
}

let tempCounter = 0;

/**
 * Picker "Créer « … »": the tag shows at once, checked on the task, with the first free board colour;
 * the saved tag replaces it.
 */
export function useCreateTag(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ tempId: _tempId, ...input }: Omit<Input<'tags.create'>, 'boardId'> & { tempId: string }) =>
      call('tags.create', { boardId, ...input }),
    onMutate: async ({ tempId, name, color, taskId }) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      patchBoard(client, boardId, (board) =>
        withTags(board, [
          ...board.tags,
          {
            id: tempId,
            name,
            color: color ?? newTagColor(board.tags.map((tag) => tag.color)),
            taskCount: taskId ? 1 : 0,
          },
        ]),
      );
      if (taskId) {
        const tags = client.getQueryData<BoardDetail>(boardKeys.detail(boardId))?.tags ?? [];
        patchTask(client, boardId, taskId, (task) => ({
          ...task,
          tagIds: sortTagIds([...task.tagIds, tempId], tags),
        }));
      }
    },
    onSuccess: (tag, { tempId, taskId }) => {
      const swap = (ids: readonly string[]) => ids.map((id) => (id === tempId ? tag.id : id));
      let tags: readonly Tag[] = [];
      patchBoard(client, boardId, (board) => {
        // The board may have been refetched meanwhile, without the temporary tag: add the saved one.
        const next = board.tags.some((t) => t.id === tempId)
          ? board.tags.map((t) => (t.id === tempId ? tag : t))
          : board.tags.some((t) => t.id === tag.id)
            ? board.tags
            : withTags(board, [...board.tags, tag]).tags;
        tags = next;
        return { ...board, tags: next };
      });
      /** The temporary id is swapped; where it is gone, the created task gets the saved tag. */
      const link = (t: Task): Task | null => {
        if (t.tagIds.includes(tempId)) return { ...t, tagIds: swap(t.tagIds) };
        if (t.id === taskId && !t.tagIds.includes(tag.id)) {
          return { ...t, tagIds: sortTagIds([...t.tagIds, tag.id], tags) };
        }
        return null;
      };
      patchBoard(client, boardId, (board) => ({
        ...board,
        tasks: board.tasks.map((t) => link(t) ?? t),
      }));
      patchCachedTasks(client, link);
    },
    onError: (_error, input) =>
      failed(client, boardId, 'createTag', () => mutation.mutate({ ...input, tempId: nextTempTagId() })),
    onSettled: (_tag, _error, { taskId }) => taskId && refreshSearch(client),
  });
  return mutation;
}

export const nextTempTagId = () => `${TEMP_TAG_PREFIX}${++tempCounter}`;

/** A name already used on the board (case and accents ignored). */
export const isConflict = (error: unknown) => error instanceof ApiError && error.code === 'conflict';

/**
 * Rename or recolour a tag, optimistic on every card of the board. A name conflict is shown in the
 * field by the caller (no toast); the board reloads to undo it.
 */
export function useUpdateTag(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: Input<'tags.update'>) => call('tags.update', input),
    onMutate: async ({ id, ...patch }) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      patchBoard(client, boardId, (board) =>
        withTags(
          board,
          board.tags.map((tag) => (tag.id === id ? { ...tag, ...defined } : tag)),
        ),
      );
    },
    onSuccess: (tag) =>
      patchBoard(client, boardId, (board) =>
        withTags(
          board,
          board.tags.map((t) => (t.id === tag.id ? tag : t)),
        ),
      ),
    onError: (error, input) => {
      if (isConflict(error)) {
        void client.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
        return;
      }
      failed(client, boardId, 'updateTag', () => mutation.mutate(input));
    },
    onSettled: (_tag, _error, input) => input.name !== undefined && refreshSearch(client),
  });
  return mutation;
}

/** Delete a tag for good (after the confirmation): it leaves the board and every task at once. */
export function useDeleteTag(boardId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => call('tags.delete', { id }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(boardId) });
      const drop = (task: Task) => ({ ...task, tagIds: task.tagIds.filter((tagId) => tagId !== id) });
      patchBoard(client, boardId, (board) => ({
        ...board,
        tags: board.tags.filter((tag) => tag.id !== id),
        tasks: board.tasks.map((task) => (task.tagIds.includes(id) ? drop(task) : task)),
      }));
      patchCachedTasks(client, (task) => (task.tagIds.includes(id) ? drop(task) : null));
    },
    onError: (_error, id) => failed(client, boardId, 'deleteTag', () => mutation.mutate(id)),
    onSettled: () => refreshSearch(client),
  });
  return mutation;
}
