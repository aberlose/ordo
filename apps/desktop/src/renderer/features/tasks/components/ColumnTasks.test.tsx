import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { today } from '@renderer/shared/lib/dates';
import { board } from '@renderer/test/fixtures';
import { ColumnTasks, type CardNavigate } from './ColumnTasks';

// jsdom has no layout: give the virtualised column a size so it renders its cards.
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 800, right: 300, width: 300, height: 800 };
const original = HTMLElement.prototype.getBoundingClientRect;
const sizes = ['offsetWidth', 'offsetHeight'] as const;
const descriptors = sizes.map((size) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, size));
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
  for (const size of sizes) {
    Object.defineProperty(HTMLElement.prototype, size, { configurable: true, get: () => 800 });
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('api', {
    invoke: () => Promise.resolve({ ok: true, data: board }),
    getPathForFile: () => '',
  });
});
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
  sizes.forEach((size, i) => {
    const descriptor = descriptors[i];
    if (descriptor) Object.defineProperty(HTMLElement.prototype, size, descriptor);
  });
  vi.unstubAllGlobals();
});

const column = board.columns[0]!;
const tasks = board.tasks.filter((task) => task.columnId === column.id);

function renderColumn(onNavigate?: CardNavigate) {
  const client = new QueryClient();
  client.setQueryData(['boards', board.id], board);
  render(
    <QueryClientProvider client={client}>
      <ColumnTasks
        boardId={board.id}
        column={column}
        tasks={tasks}
        today={today()}
        emptyHint={null}
        onKeyboardMove={() => true}
        onNavigate={onNavigate}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole('button', { name: /Mettre à jour les dépendances/ });
}

const arrowDown = () => new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });

describe('ColumnTasks plain arrows', () => {
  it('are left to the browser when nothing navigates', () => {
    const event = arrowDown();
    renderColumn().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('are handled when a navigation handler exists', () => {
    const navigate = vi.fn<CardNavigate>(() => null);
    const event = arrowDown();
    renderColumn(navigate).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(tasks[0]!.id, 'down');
  });
});
