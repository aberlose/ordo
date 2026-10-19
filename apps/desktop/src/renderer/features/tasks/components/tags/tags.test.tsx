import type { BoardDetail, Tag, Task } from '@ordo/contracts';
import { compareTags } from '@ordo/domain';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boardKeys } from '@renderer/shared/api/keys';
import { today } from '@renderer/shared/lib/dates';
import { taggedBoard, tags } from '@renderer/test/fixtures';
import { TaskCard } from '../TaskCard';
import { fitTags } from './CardTags';
import { TaskTags, type TaskTagsProps } from './TaskTags';

const header = taggedBoard.tasks[4]!;
const tagNamed = (name: string) => tags.find((t) => t.name === name)!;

type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
let invoke: ReturnType<typeof vi.fn<(channel: string, input: Record<string, unknown>) => Promise<Reply>>>;

/** A fake main process answering the tag channels from a copy of the board. */
function fakeApi(overrides: Record<string, Reply> = {}) {
  const state: BoardDetail = structuredClone(taggedBoard);
  const taskOf = (id: unknown) => state.tasks.find((t) => t.id === id)!;
  invoke = vi.fn(async (channel: string, input: Record<string, unknown>): Promise<Reply> => {
    const override = overrides[channel];
    if (override) return override;
    switch (channel) {
      case 'tasks.addTag':
      case 'tasks.removeTag': {
        const task = taskOf(input['taskId']);
        const others = task.tagIds.filter((id) => id !== input['tagId']);
        task.tagIds = channel === 'tasks.addTag' ? [...others, input['tagId'] as string] : others;
        return { ok: true, data: task };
      }
      case 'tags.create': {
        const tag: Tag = { id: 'saved-tag', name: input['name'] as string, color: 'pink', taskCount: 1 };
        state.tags = [...state.tags, tag].sort(compareTags);
        return { ok: true, data: tag };
      }
      case 'tags.update': {
        const tag = state.tags.find((t) => t.id === input['id'])!;
        return { ok: true, data: { ...tag, ...input } };
      }
      case 'tags.delete':
        return { ok: true, data: { id: input['id'], removedFrom: 9 } };
      default:
        return { ok: true, data: state };
    }
  });
  vi.stubGlobal('api', { invoke });
}

/** The detail's Tags row, reading its task from the board cache as the detail window does. */
function Row({ picker }: Pick<TaskTagsProps, 'picker'>) {
  const { data } = useQuery<BoardDetail>({ queryKey: boardKeys.detail(taggedBoard.id) });
  const task = data?.tasks.find((t) => t.id === header.id) as Task;
  return <TaskTags boardId={taggedBoard.id} task={task} {...(picker ? { picker } : {})} />;
}

function renderRow(picker?: TaskTagsProps['picker']) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(boardKeys.detail(taggedBoard.id), taggedBoard);
  render(
    <QueryClientProvider client={client}>
      <Row {...(picker ? { picker } : {})} />
    </QueryClientProvider>,
  );
  return client;
}

/** Lets the mutation run (TanStack Query notifies on a timer) and React render. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
/** French typography puts no-break spaces around « » and before ?. */
const text = (element: Element | null | undefined) => element?.textContent?.replace(/\u00a0/g, ' ') ?? '';

const option = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}`) });
const lastCall = () => invoke.mock.calls.at(-1);

beforeEach(() => fakeApi());

describe('TaskTags', () => {
  it('shows the task’s chips and removes one with Delete, the focus going to the next chip', async () => {
    renderRow();
    const remove = screen.getByRole('button', { name: 'Retirer design' });
    remove.focus();
    fireEvent.keyDown(remove, { key: 'Delete' });
    await settle();
    expect(lastCall()).toEqual(['tasks.removeTag', { taskId: header.id, tagId: tagNamed('design').id }]);
    expect(screen.queryByRole('button', { name: 'Retirer design' })).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Retirer front');
  });

  it('gives the focus to "+" after removing the last chip', async () => {
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer urgent' }));
    await settle();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Ajouter un tag');
  });
});

describe('TagPicker', () => {
  it('lists the board’s tags with their check and count, and toggles without closing', async () => {
    renderRow({ defaultOpen: true });
    const list = screen.getByRole('listbox', { name: 'Tags du board' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(within(list).getAllByRole('option')).toHaveLength(tags.length);
    expect(option('front').getAttribute('aria-selected')).toBe('true');
    expect(option('back').getAttribute('aria-selected')).toBe('false');

    fireEvent.click(option('back'));
    await settle();
    expect(lastCall()).toEqual(['tasks.addTag', { taskId: header.id, tagId: tagNamed('back').id }]);
    expect(option('back').getAttribute('aria-selected')).toBe('true');
    expect(option('back').textContent).toContain('7');
    // The chip shows in the row, alphabetically, and the picker stays open.
    expect(screen.getByRole('button', { name: 'Retirer back' })).toBeTruthy();
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(option('front'));
    await settle();
    expect(lastCall()).toEqual(['tasks.removeTag', { taskId: header.id, tagId: tagNamed('front').id }]);
    expect(option('front').getAttribute('aria-selected')).toBe('false');
  });

  it('moves with ↑↓, toggles with Enter, and closes with Escape back to "+"', async () => {
    renderRow({ defaultOpen: true });
    const search = screen.getByRole('combobox', { name: 'Rechercher ou créer un tag' });
    expect(document.activeElement).toBe(search);
    const active = () => document.getElementById(search.getAttribute('aria-activedescendant') ?? '');
    expect(active()?.textContent).toContain('accessibilité');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(active()?.textContent).toContain('back');
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    expect(active()?.textContent).toContain('urgent');
    fireEvent.keyDown(search, { key: 'Enter' });
    await settle();
    expect(lastCall()).toEqual(['tasks.removeTag', { taskId: header.id, tagId: tagNamed('urgent').id }]);

    // A partial match comes first, then the offer to create the typed name.
    fireEvent.change(search, { target: { value: 'conte' } });
    expect(screen.getAllByRole('option').map((o) => text(o))).toEqual([
      expect.stringContaining('contenu'),
      expect.stringContaining('Créer « conte »'),
    ]);
    expect(active()?.textContent).toContain('contenu');

    fireEvent.keyDown(search, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Ajouter un tag');
  });

  it('creates a tag from the search, checked on the task', async () => {
    renderRow({ defaultOpen: true });
    const search = screen.getByRole('combobox');
    fireEvent.change(search, { target: { value: '  Relecture ' } });
    const create = screen.getByRole('option', { name: /Créer\s«\sRelecture\s»/ });
    expect(create.textContent).toContain('Couleur automatique, modifiable avec ⋯');
    // An existing name, whatever its case or accents, is not offered for creation.
    fireEvent.change(search, { target: { value: 'ACCESSIBILITE' } });
    expect(screen.queryByRole('option', { name: /Créer/ })).toBeNull();

    fireEvent.change(search, { target: { value: 'Relecture' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    await settle();
    expect(lastCall()).toEqual([
      'tags.create',
      { boardId: taggedBoard.id, name: 'Relecture', taskId: header.id },
    ]);
    expect((search as HTMLInputElement).value).toBe('');
    expect(option('Relecture').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Retirer Relecture' })).toBeTruthy();
  });

  it('renames a tag on Enter, and keeps the field with a message when the name is taken', async () => {
    fakeApi({ 'tags.update': { ok: false, error: { code: 'conflict', message: 'taken' } } });
    renderRow({ defaultOpen: true, defaultManageId: tagNamed('design').id });
    expect(screen.getByRole('dialog', { name: 'Modifier le tag' })).toBeTruthy();
    const name = screen.getByRole('textbox');
    expect((name as HTMLInputElement).value).toBe('design');

    // Already on the board (case ignored): refused at once, nothing sent.
    fireEvent.change(name, { target: { value: 'Front' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(text(screen.getByRole('alert'))).toBe('Un tag « Front » existe déjà sur ce board.');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(invoke).not.toHaveBeenCalledWith('tags.update', expect.anything());

    // Taken according to the main process: the message shows too, the draft stays.
    fireEvent.change(name, { target: { value: 'maquette' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(name, { key: 'Enter' });
    await settle();
    expect(invoke).toHaveBeenCalledWith('tags.update', { id: tagNamed('design').id, name: 'maquette' });
    expect(screen.getByRole('alert').textContent).toContain('maquette');
    expect((name as HTMLInputElement).value).toBe('maquette');
  });

  it('applies a colour at once', async () => {
    renderRow({ defaultOpen: true, defaultManageId: tagNamed('design').id });
    expect(screen.getByRole('radio', { name: 'Violet' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Rose' }));
    await settle();
    expect(lastCall()).toEqual(['tags.update', { id: tagNamed('design').id, color: 'pink' }]);
    expect(screen.getByRole('radio', { name: 'Rose' }).getAttribute('aria-checked')).toBe('true');
  });

  it('opens the manage page from ⋯ and goes back to the list', () => {
    renderRow({ defaultOpen: true });
    fireEvent.mouseEnter(option('SEO'));
    fireEvent.click(screen.getByRole('button', { name: 'Gérer le tag SEO' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('SEO');
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux tags' }));
    const search = screen.getByRole('combobox');
    expect(
      document.getElementById(search.getAttribute('aria-activedescendant') ?? '')?.textContent,
    ).toContain('SEO');
  });

  it('goes back to the list with Escape on the manage page, dropping the name being typed', async () => {
    renderRow({ defaultOpen: true, defaultManageId: tagNamed('design').id });
    const name = screen.getByRole('textbox');
    fireEvent.change(name, { target: { value: 'maquette' } });
    fireEvent.keyDown(name, { key: 'Escape' });
    await settle();
    // Still open, on the list, with the tag active and its name unchanged.
    const search = screen.getByRole('combobox');
    expect(
      document.getElementById(search.getAttribute('aria-activedescendant') ?? '')?.textContent,
    ).toContain('design');
    expect(invoke).not.toHaveBeenCalledWith('tags.update', expect.anything());
    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('design');
  });

  it('opens the active tag’s page with → at the end of the search', () => {
    renderRow({ defaultOpen: true, defaultQuery: 'se' });
    const search = screen.getByRole('combobox') as HTMLInputElement;
    expect(search.getAttribute('aria-keyshortcuts')).toBe('ArrowRight');
    expect(document.getElementById(search.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Flèche droite : modifier le tag actif.',
    );
    // The caret inside the query: → moves it, the list stays.
    search.setSelectionRange(0, 0);
    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    search.setSelectionRange(2, 2);
    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('SEO');
  });

  it('keeps the focused ⋯ when the mouse makes another option active', () => {
    renderRow({ defaultOpen: true });
    const manage = screen.getByRole('button', { name: 'Gérer le tag accessibilité' });
    manage.focus();
    fireEvent.mouseEnter(option('SEO'));
    expect(document.activeElement).toBe(manage);
    expect(manage.isConnected).toBe(true);
  });

  it('confirms a delete in the footer, Annuler focused, then removes the tag everywhere', async () => {
    renderRow({ defaultOpen: true, defaultManageId: tagNamed('design').id });
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le tag' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Supprimer le tag' });
    expect(text(confirm)).toContain('Supprimer « design » ? Il sera retiré de 9 tâches.');
    expect(document.activeElement?.textContent).toBe('Annuler');

    fireEvent.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement?.textContent).toContain('Supprimer le tag');

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le tag' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await settle();
    expect(lastCall()).toEqual(['tags.delete', { id: tagNamed('design').id }]);
    expect(screen.queryByRole('option', { name: /^design/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer design' })).toBeNull();
  });
});

describe('Card tags', () => {
  it('fits the tags on one line and sums up the rest', () => {
    const more = () => 24;
    expect(fitTags([60, 60, 60], 200, more)).toBe(3);
    expect(fitTags([60, 60, 60, 60], 200, more)).toBe(2);
    // At least one tag shows, shortened.
    expect(fitTags([300, 60], 200, more)).toBe(1);
  });

  it('shows the tags of a card with "+N", and no tag line without tags', () => {
    const looks = new Map(tags.map((t) => [t.id, t]));
    const { container, rerender } = render(
      <TaskCard
        task={{ ...header, subtasks: { done: 3, total: 5 } }}
        today={today()}
        tags={looks}
        color="blue"
        onOpen={() => undefined}
      />,
    );
    const card = screen.getByRole('button');
    expect(card.textContent).toContain('accessibilité');
    expect(card.textContent).toMatch(/\+\d/);
    // Screen readers read one list of every tag; the chips and "+N" are hidden from them.
    const names = header.tagIds
      .map((id) => tags.find((t) => t.id === id)!.name)
      .sort((a, b) => compareTags({ name: a }, { name: b }));
    expect(text(screen.getByText(/^Tags :/))).toBe(`Tags : ${names.join(', ')}`);
    expect(screen.getByText(/^\+\d/).closest('[aria-hidden="true"]')).toBeTruthy();
    expect(text(card)).toContain('Sous-tâches terminées : 3 sur 5');
    const withTags = container.innerHTML;
    rerender(
      <TaskCard task={{ ...header, tagIds: [] }} today={today()} tags={looks} onOpen={() => undefined} />,
    );
    expect(container.innerHTML.length).toBeLessThan(withTags.length);
    expect(screen.getByRole('button').textContent).not.toContain('accessibilité');
    expect(screen.getByRole('button').textContent).not.toContain('Sous-tâches');
  });
});
