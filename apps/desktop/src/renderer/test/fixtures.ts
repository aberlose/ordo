import type { BoardDetail, Column, Task } from '@ordo/contracts';
import { addDays } from '@ordo/domain';
import { today } from '@renderer/shared/lib/dates';

/** Realistic French data for stories and component tests. Dates are relative to today. */
export const columns: Column[] = [
  {
    id: '01920000-0000-7000-8000-000000000011',
    name: 'À faire',
    icon: 'inbox',
    color: 'slate',
    category: 'todo',
    displayLimit: null,
    rank: 'V',
  },
  {
    id: '01920000-0000-7000-8000-000000000012',
    name: 'En cours',
    icon: 'play',
    color: 'blue',
    category: 'in_progress',
    displayLimit: null,
    rank: 'k',
  },
  {
    id: '01920000-0000-7000-8000-000000000013',
    name: 'Terminé',
    icon: 'circle-check',
    color: 'green',
    category: 'done',
    displayLimit: null,
    rank: 's',
  },
];

const day = (offset: number) => addDays(today(), offset);
/** Fixed "now" for stories and tests. */
export const now = Date.now();
const at = now;
let n = 100;
const task = (columnIndex: number, rank: string, fields: Partial<Task> & { title: string }): Task => ({
  id: `01920000-0000-7000-8000-000000000${++n}`,
  columnId: columns[columnIndex]!.id,
  parentId: null,
  key: n - 100,
  priority: 3,
  startDate: null,
  dueDate: null,
  rank,
  completedAt: columnIndex === 2 ? at : null,
  createdAt: at - 5 * 86_400_000,
  updatedAt: at - 2 * 3_600_000,
  tagIds: [],
  subtasks: { done: 0, total: 0 },
  ...fields,
});

export const tasks: Task[] = [
  task(0, 'V', { title: 'Mettre à jour les dépendances', priority: 2, dueDate: day(4) }),
  task(0, 'k', { title: "Rédiger le compte rendu de l'atelier", priority: 4, dueDate: day(2) }),
  task(0, 's', { title: 'Préparer la démo client pour le comité de jeudi' }),
  task(1, 'V', {
    title: "Corriger l'export PDF des factures",
    priority: 4,
    startDate: day(-8),
    dueDate: day(-2),
  }),
  task(1, 'k', { title: 'Intégrer le nouveau header', priority: 5, dueDate: day(7) }),
  task(2, 'V', { title: 'Relire le contrat de maintenance', priority: 1 }),
];

export const emptyBoard: BoardDetail = {
  id: '01920000-0000-7000-8000-000000000001',
  name: 'Mon premier board',
  icon: null,
  color: null,
  taskCount: 0,
  columns,
  tags: [],
  tasks: [],
};

export const board: BoardDetail = {
  ...emptyBoard,
  name: 'Refonte site client',
  taskCount: tasks.length,
  tasks,
};
