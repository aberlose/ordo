import type { Task } from '@ordo/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { boardKeys, taskKeys } from '@renderer/shared/api/keys';
import { today } from '@renderer/shared/lib/dates';
import { boardWithSubtasks, columns, subtaskParent, subtasks } from '@renderer/test/fixtures';
import { useTaskUi } from '../../store';
import { TaskDetail } from '../TaskDetail';
import { SubtaskList, type SubtaskListProps } from './SubtaskList';
import { SubtaskSection } from './SubtaskSection';

beforeAll(() => {
  // Radix menus measure their trigger.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const doneColumn = columns[2]!;
const todo = subtasks[4]!;
const finished = subtasks[0]!;
const checkbox = (title: string) => screen.getByRole('checkbox', { name: `Sous-tâche terminée : ${title}` });

/** A fake main process holding the parent's sub-tasks; returns the `invoke` spy. */
function mockApi() {
  let list = [...subtasks];
  let created = 0;
  const handle = (channel: string, input: Record<string, unknown>): unknown => {
    switch (channel) {
      case 'boards.get':
        return boardWithSubtasks;
      case 'tasks.listSubtasks':
        return list;
      case 'tasks.get':
        return list.find((s) => s.id === input['id']);
      case 'tasks.update': {
        const { id, ...change } = input;
        list = list.map((s) => (s.id === id ? { ...s, ...change } : s));
        return list.find((s) => s.id === id);
      }
      case 'tasks.create': {
        const task: Task = {
          ...subtasks[4]!,
          id: `01920000-0000-7000-8000-00000000099${++created}`,
          title: input['title'] as string,
          rank: 'z',
        };
        list = [...list, task];
        return task;
      }
      case 'tasks.delete':
        list = list.filter((s) => s.id !== input['id']);
        return { id: input['id'] };
      default:
        return input;
    }
  };
  const invoke = vi.fn((channel: string, input: Record<string, unknown>) =>
    Promise.resolve({ ok: true, data: handle(channel, input) }),
  );
  vi.stubGlobal('api', { invoke });
  return invoke;
}

function withClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(boardKeys.detail(boardWithSubtasks.id), boardWithSubtasks);
  client.setQueryData(taskKeys.subtasks(subtaskParent.id), subtasks);
  return { client, ui: <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

afterEach(() => {
  vi.unstubAllGlobals();
  useTaskUi.setState({ openTaskId: null, expanded: false });
});

describe('SubtaskList', () => {
  const setup = (overrides: Partial<SubtaskListProps> = {}) => {
    const props = {
      onToggle: vi.fn(),
      onMove: vi.fn(),
      onOpen: vi.fn(),
      onAdd: vi.fn(),
    };
    render(<SubtaskList subtasks={subtasks} columns={columns} color="blue" {...props} {...overrides} />);
    return props;
  };

  it('shows done/total, struck done rows and each status', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Sous-tâches' })).toBeTruthy();
    expect(screen.getByLabelText('3 sur 5 terminées').textContent).toBe('3/5');
    expect(checkbox(finished.title).getAttribute('aria-checked')).toBe('true');
    expect(checkbox(todo.title).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: finished.title }).className).toContain('line-through');
    expect(
      screen.getByRole('button', { name: `Statut de « ${todo.title} » : À faire` }).textContent,
    ).toContain('À faire');
  });

  it('adds on Enter and stays open, closes on Escape and gives the focus back', () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une sous-tâche' }));
    const field = screen.getByRole('textbox', { name: 'Titre de la sous-tâche' }) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Vérifier le contraste du menu' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Vérifier le contraste du menu');
    expect(field.value).toBe('');
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Titre de la sous-tâche' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajouter une sous-tâche' }));
  });

  it('shows the empty state, whose button opens the field', () => {
    setup({ subtasks: [] });
    expect(screen.getByText('Aucune sous-tâche')).toBeTruthy();
    expect(screen.queryByLabelText(/terminées/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une sous-tâche' }));
    expect(screen.getByRole('textbox', { name: 'Titre de la sous-tâche' })).toBeTruthy();
    expect(screen.queryByText('Aucune sous-tâche')).toBeNull();
  });

  it('changes the status from the menu of the row', async () => {
    const { onMove } = setup();
    const trigger = screen.getByRole('button', { name: `Statut de « ${todo.title} » : À faire` });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    // Radix names the menu after its trigger.
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual(['À faire', 'En cours', 'Terminé']);
    expect(items[0]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[1]!);
    expect(onMove).toHaveBeenCalledWith(todo, columns[1]!.id);
  });

  it('opens a sub-task from its title, but not one still being saved', () => {
    const temp: Task = { ...todo, id: 'temp-sub-1', title: 'En cours d’enregistrement' };
    const { onOpen } = setup({ subtasks: [...subtasks, temp] });
    fireEvent.click(screen.getByRole('button', { name: todo.title }));
    expect(onOpen).toHaveBeenCalledWith(todo);
    fireEvent.click(screen.getByRole('button', { name: temp.title }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('SubtaskSection', () => {
  it('checks into the first Done column and unchecks into the first To-do column', async () => {
    const invoke = mockApi();
    const { client, ui } = withClient(
      <SubtaskSection parent={subtaskParent} board={boardWithSubtasks} onOpen={() => undefined} />,
    );
    render(ui);

    fireEvent.click(checkbox(todo.title));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('tasks.update', { id: todo.id, columnId: doneColumn.id }),
    );
    // Optimistic: the row and the parent's progress on the board.
    expect(checkbox(todo.title).getAttribute('aria-checked')).toBe('true');
    const parent = client
      .getQueryData<typeof boardWithSubtasks>(boardKeys.detail(boardWithSubtasks.id))!
      .tasks.find((t) => t.id === subtaskParent.id)!;
    expect(parent.subtasks).toEqual({ done: 4, total: 5 });

    fireEvent.click(checkbox(finished.title));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('tasks.update', { id: finished.id, columnId: columns[0]!.id }),
    );
  });

  it('adds a sub-task to the parent, shown at once', async () => {
    const invoke = mockApi();
    const { ui } = withClient(
      <SubtaskSection parent={subtaskParent} board={boardWithSubtasks} onOpen={() => undefined} />,
    );
    render(ui);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une sous-tâche' }));
    const field = screen.getByRole('textbox', { name: 'Titre de la sous-tâche' });
    fireEvent.change(field, { target: { value: 'Vérifier le contraste' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByRole('button', { name: 'Vérifier le contraste' })).toBeTruthy();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('tasks.create', {
        parentId: subtaskParent.id,
        title: 'Vérifier le contraste',
      }),
    );
  });
});

describe('SubtaskSection load error', () => {
  it('shows the dashed box with the message and "Réessayer", which loads the list again', async () => {
    let fail = true;
    const invoke = vi.fn((channel: string) =>
      Promise.resolve(
        channel === 'tasks.listSubtasks' && fail
          ? { ok: false, error: { code: 'internal', message: 'disk' } }
          : { ok: true, data: channel === 'tasks.listSubtasks' ? subtasks : boardWithSubtasks },
      ),
    );
    vi.stubGlobal('api', { invoke });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(boardKeys.detail(boardWithSubtasks.id), boardWithSubtasks);
    render(
      <QueryClientProvider client={client}>
        <SubtaskSection parent={subtaskParent} board={boardWithSubtasks} onOpen={() => undefined} />
      </QueryClientProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger les sous-tâches.');
    expect(screen.queryByText('Aucune sous-tâche')).toBeNull();
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: todo.title })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SubtaskRow done box', () => {
  it('fills a done box with the AA text variant of its column colour', () => {
    render(
      <SubtaskList
        subtasks={[finished]}
        columns={columns}
        color="blue"
        onToggle={vi.fn()}
        onMove={vi.fn()}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(checkbox(finished.title).style.backgroundColor).toBe(`var(--col-${doneColumn.color}-text)`);
  });
});

describe('TaskDetail with sub-tasks', () => {
  it('opens a sub-task in the same window and goes back to the parent', async () => {
    mockApi();
    act(() => useTaskUi.getState().openTask(subtaskParent.id));
    const { ui } = withClient(<TaskDetail board={boardWithSubtasks} today={today()} />);
    render(ui);

    const sub = subtasks[3]!;
    // The window and its section are lazy: the first open loads them.
    fireEvent.click(await screen.findByRole('button', { name: sub.title }, { timeout: 5000 }));

    // The sub-task window: breadcrumb, "Sous-tâche de" button, "Parente" row, no Sub-tasks section.
    const title = (await screen.findByRole('textbox', { name: 'Titre de la tâche' })) as HTMLTextAreaElement;
    await waitFor(() => expect(title.value).toBe(sub.title));
    const back = screen.getByRole('button', {
      name: /^Sous-tâche de « Intégrer le nouveau header », 3 sur 5/,
    });
    expect(back.textContent).toContain('3/5');
    expect(screen.getByRole('button', { name: 'Parente : Intégrer le nouveau header' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Sous-tâches' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(back));

    fireEvent.click(back);
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Titre de la tâche' }) as HTMLTextAreaElement).value).toBe(
        subtaskParent.title,
      ),
    );
    expect(screen.getByRole('heading', { name: 'Sous-tâches' })).toBeTruthy();
    // The focus returns to the row of the sub-task we came from.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: sub.title })));
  });

  it('deletes a sub-task from its window and returns to the parent', async () => {
    const invoke = mockApi();
    const sub = subtasks[3]!;
    const { client, ui } = withClient(<TaskDetail board={boardWithSubtasks} today={today()} />);
    client.setQueryData(taskKeys.detail(sub.id), sub);
    act(() => useTaskUi.getState().openTask(sub.id));
    render(ui);

    fireEvent.keyDown(await screen.findByRole('button', { name: "Plus d'actions" }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer la sous-tâche' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('tasks.delete', { id: sub.id }));
    expect(useTaskUi.getState().openTaskId).toBe(subtaskParent.id);
    expect(await screen.findByRole('heading', { name: 'Sous-tâches' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: sub.title })).toBeNull();
  });
});
