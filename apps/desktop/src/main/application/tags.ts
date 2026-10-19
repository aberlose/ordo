import type { CreateTagInput, DeleteTagOutput, Tag, UpdateTagInput } from '@ordo/contracts';
import { isSameTagName, newTagColor, normalizeTagName } from '@ordo/domain';
import { ConflictError, NotFoundError, RuleViolationError } from './errors';
import type {
  BoardRepository,
  Clock,
  IdGenerator,
  TagRecord,
  TagRepository,
  TagWithCount,
  TaskRepository,
  Transactor,
} from './ports';

export interface TagUseCasesDeps {
  readonly boards: BoardRepository;
  readonly tags: TagRepository;
  readonly tasks: TaskRepository;
  readonly tx: Transactor;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export function toTag(tag: TagWithCount): Tag {
  return { id: tag.id, name: tag.name, color: tag.color, taskCount: tag.taskCount };
}

export function makeTagUseCases({ boards, tags, tasks, tx, clock, ids }: TagUseCasesDeps) {
  const requireTag = (id: string) => {
    const tag = tags.findById(id);
    if (!tag) throw new NotFoundError('tag', id);
    return tag;
  };
  /** The counted read: only for outputs that show the count. */
  const requireTagWithCount = (id: string) => {
    const tag = tags.findWithCountById(id);
    if (!tag) throw new NotFoundError('tag', id);
    return tag;
  };

  /** A normalised name no other tag of the board (`boardTags`) uses, whatever its case or accents. */
  const requireFreeName = (boardTags: readonly TagRecord[], raw: string, selfId: string | null) => {
    const name = normalizeTagName(raw);
    if (name === '') throw new RuleViolationError('A tag needs a name');
    const taken = boardTags.some((t) => t.id !== selfId && isSameTagName(t.name, name));
    if (taken) throw new ConflictError(`A tag named "${name}" already exists on the board`);
    return name;
  };

  return {
    /** A tag on a sidebar board, put on `taskId` in the same transaction when given. */
    createTag: (input: CreateTagInput): Tag =>
      tx.run(() => {
        const board = boards.findById(input.boardId);
        if (!board) throw new NotFoundError('board', input.boardId);
        if (board.archivedAt !== null) throw new RuleViolationError(`Board ${board.id} is archived`);
        const task = input.taskId === undefined ? null : tasks.findById(input.taskId);
        if (input.taskId !== undefined && !task) throw new NotFoundError('task', input.taskId);
        if (task && task.boardId !== board.id)
          throw new RuleViolationError('The task belongs to another board');

        const boardTags = tags.listByBoard(board.id);
        const name = requireFreeName(boardTags, input.name, null);
        const id = ids.next();
        const color = input.color ?? newTagColor(boardTags.map((t) => t.color));
        tags.insert({ id, boardId: board.id, name, color });
        if (task) {
          tags.addLink({ taskId: task.id, tagId: id });
          tasks.update(task.id, { updatedAt: clock.now() });
        }
        return toTag(requireTagWithCount(id));
      }),

    /** Rename or recolour: every task of the board shows the change. */
    updateTag: (input: UpdateTagInput): Tag =>
      tx.run(() => {
        const current = requireTag(input.id);
        tags.update(current.id, {
          ...(input.name !== undefined
            ? { name: requireFreeName(tags.listByBoard(current.boardId), input.name, current.id) }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        });
        return toTag(requireTagWithCount(current.id));
      }),

    /** Permanent: the links, then the tag. `removedFrom` counts the live tasks that carried it. */
    deleteTag: (id: string): DeleteTagOutput =>
      tx.run(() => {
        const current = requireTagWithCount(id);
        tags.removeLinksOfTag(id);
        tags.delete(id);
        return { id, removedFrom: current.taskCount };
      }),
  };
}

export type TagUseCases = ReturnType<typeof makeTagUseCases>;
