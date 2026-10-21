import type { BoardDetail, Column, Tag, Task } from '@ordo/contracts';
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
  attachmentCount: 0,
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

/** "Intégrer le nouveau header" and its sub-tasks (approved mockup: tags-subtasks/SubtaskRows, 3/5 done). */
export const subtaskParent: Task = { ...tasks[4]!, subtasks: { done: 3, total: 5 } };
const subtask = (columnIndex: number, rank: string, title: string): Task =>
  task(columnIndex, rank, { title, parentId: subtaskParent.id, priority: 3 });
export const subtasks: Task[] = [
  subtask(2, 'V', 'Structure HTML du header'),
  subtask(2, 'd', 'Logo SVG optimisé'),
  subtask(2, 'k', 'Intégration desktop'),
  subtask(1, 's', 'Menu burger mobile'),
  subtask(0, 'w', 'Tests d’accessibilité clavier'),
];
/** `board` with the parent's progress filled in (the card ring and the sub-task window read it). */
export const boardWithSubtasks: BoardDetail = {
  ...board,
  tasks: tasks.map((t) => (t.id === subtaskParent.id ? subtaskParent : t)),
};

const tag = (n: number, name: string, color: Tag['color'], taskCount: number): Tag => ({
  id: `01920000-0000-7000-8000-000000000${200 + n}`,
  name,
  color,
  taskCount,
});
/** The board's tags, alphabetical (approved mockup: tags-subtasks/TagPicker A). */
export const tags: Tag[] = [
  tag(1, 'accessibilité', 'cyan', 5),
  tag(2, 'back', 'teal', 6),
  tag(3, 'contenu', 'amber', 6),
  tag(4, 'design', 'violet', 9),
  tag(5, 'front', 'blue', 14),
  tag(6, 'SEO', 'green', 4),
  tag(7, 'urgent', 'red', 3),
];
const tagIds = (...names: string[]) => tags.filter((t) => names.includes(t.name)).map((t) => t.id);
/** "Intégrer le nouveau header" with five tags (two past the card's line) and "Rédiger…" with one. */
export const taggedTasks: Task[] = tasks.map((t, index) =>
  index === 4
    ? { ...t, tagIds: tagIds('accessibilité', 'design', 'front', 'SEO', 'urgent') }
    : index === 1
      ? { ...t, tagIds: tagIds('contenu') }
      : t,
);
/** `board` with its tags on a couple of tasks. */
export const taggedBoard: BoardDetail = { ...board, tags, tasks: taggedTasks };
