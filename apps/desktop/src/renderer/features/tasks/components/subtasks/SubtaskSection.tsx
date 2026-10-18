import type { BoardDetail, Task } from '@ordo/contracts';
import { columnForSubtaskCheck } from '@ordo/domain';
import { useCallback } from 'react';
import { useCreateSubtask, useSubtasks, useUpdateSubtask } from '../../hooks/subtasks';
import { TEMP_ID_PREFIX } from '../TaskCard';
import { SubtaskList } from './SubtaskList';

let tempCounter = 0;

/** Sub-tasks of a top-level task in its window, wired to `tasks.listSubtasks` and the sub-task mutations. */
export function SubtaskSection({
  parent,
  board,
  onOpen,
}: {
  parent: Task;
  board: BoardDetail;
  onOpen: (task: Task) => void;
}) {
  const { data: subtasks, isError, refetch } = useSubtasks(parent.id);
  const create = useCreateSubtask(board.id);
  const update = useUpdateSubtask(board.id);
  const { mutate } = update;
  const columns = board.columns;
  const color = columns.find((c) => c.id === parent.columnId)?.color ?? 'slate';

  const onToggle = useCallback(
    (task: Task, done: boolean) => {
      const columnId = columnForSubtaskCheck(columns, done);
      if (columnId && columnId !== task.columnId) mutate({ id: task.id, parentId: parent.id, columnId });
    },
    [columns, mutate, parent.id],
  );
  const onMove = useCallback(
    (task: Task, columnId: string) => mutate({ id: task.id, parentId: parent.id, columnId }),
    [mutate, parent.id],
  );

  return (
    <SubtaskList
      subtasks={subtasks}
      columns={columns}
      color={color}
      loadError={isError && !subtasks}
      onRetry={() => void refetch()}
      onToggle={onToggle}
      onMove={onMove}
      onOpen={onOpen}
      onAdd={(title) =>
        create.mutate({ parentId: parent.id, title, tempId: `${TEMP_ID_PREFIX}sub-${++tempCounter}` })
      }
    />
  );
}
