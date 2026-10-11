import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OrdoApi } from '@ordo/contracts';
import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Performance budget (docs/architecture.md): a board of 10,000 tasks stays fluid.
 * Seeds the board through the real IPC API, restarts, and checks that columns are virtualised,
 * the board shows quickly and a keyboard move stays instant.
 */
const TASKS = 10_000;

test('a board of 10,000 tasks stays fluid', async () => {
  test.setTimeout(180_000);
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-perf-'));
  const launch = () =>
    electron.launch({
      args: [fileURLToPath(new URL('..', import.meta.url))],
      env: { ...process.env, ORDO_USER_DATA: dataDir },
    });

  let app = await launch();
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();
  await expect(page.getByRole('region', { name: 'À faire' })).toBeVisible();

  await page.evaluate(async (count) => {
    const { api } = globalThis as unknown as { api: OrdoApi };
    const boards = await api.invoke('boards.list', {});
    if (!boards.ok) throw new Error('boards.list failed');
    const board = await api.invoke('boards.get', { id: boards.data[0]!.id });
    if (!board.ok) throw new Error('boards.get failed');
    const columns = board.data.columns.map((c: { id: string }) => c.id);
    for (let start = 0; start < count; start += 250) {
      await Promise.all(
        Array.from({ length: Math.min(250, count - start) }, (_, i) =>
          api.invoke('tasks.create', {
            columnId: columns[(start + i) % columns.length]!,
            title: `Tâche générée ${start + i + 1}`,
          }),
        ),
      );
    }
  }, TASKS);
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  const started = Date.now();
  await expect(page.getByRole('button', { name: /^Tâche générée 1 / })).toBeVisible({ timeout: 15_000 });
  const shownIn = Date.now() - started;
  // Budget: cold start to board shown < 1.5 s (docs/architecture.md#performance-budgets).
  expect(shownIn).toBeLessThan(1_500);
  test
    .info()
    .annotations.push({ type: 'perf', description: `[perf] board of ${TASKS} tasks shown in ${shownIn} ms` });
  await expect(page.getByText(/^10\D?000 tâches$/)).toBeVisible();

  // Virtualised columns: only a window of cards is in the DOM.
  const rendered = await page.locator('[data-task-id]').count();
  test.info().annotations.push({ type: 'perf', description: `[perf] ${rendered} cards in the DOM` });
  expect(rendered).toBeLessThan(150);

  // A keyboard move is applied at once (optimistic), whatever the board size.
  const card = page.getByRole('button', { name: /^Tâche générée 1 / });
  await card.focus();
  const before = Date.now();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('[data-task-id]').nth(1)).toContainText('Tâche générée 1');
  test.info().annotations.push({
    type: 'perf',
    description: `[perf] keyboard move shown in ${Date.now() - before} ms`,
  });
  expect(Date.now() - before).toBeLessThan(1_000);

  await app.close();
});
