import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';

const launch = (dataDir: string) =>
  electron.launch({
    args: [fileURLToPath(new URL('..', import.meta.url))],
    env: { ...process.env, ORDO_USER_DATA: dataDir },
  });

/** Native drag and drop needs several pointer moves for dragover events; `dragTo` jumps straight to the target. */
async function drag(window: Page, from: Locator, to: Locator, offset: { x: number; y: number }) {
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  await window.mouse.move(start.x + 40, start.y + 16);
  await window.mouse.down();
  await window.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2 + 8, { steps: 4 });
  await window.mouse.move(end.x + offset.x, end.y + offset.y, { steps: 16 });
  await window.mouse.up();
}

const cardTitles = (window: Page, column: string) =>
  window.getByRole('region', { name: column }).locator('[data-task-id] > span:first-child').allInnerTexts();

test('move cards and columns with the mouse and the keyboard, and keep the order', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let window = await app.firstWindow();

  await window.getByRole('button', { name: /Créer un board vide/ }).click();
  await window.getByRole('button', { name: 'Nouvelle tâche' }).click();
  const field = window.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  for (const title of ['Relire le contrat', 'Préparer la démo', 'Mettre à jour les dépendances']) {
    await field.fill(title);
    await field.press('Enter');
  }
  await field.press('Escape');
  await expect.poll(() => cardTitles(window, 'À faire')).toHaveLength(3);

  // Mouse: drag the last card into the empty "En cours" column.
  const card = window.getByRole('button', { name: /Mettre à jour les dépendances/ });
  await drag(window, card, window.getByRole('region', { name: 'En cours' }), { x: 140, y: 80 });
  await expect.poll(() => cardTitles(window, 'En cours')).toEqual(['Mettre à jour les dépendances']);

  // Mouse: reorder within a column (second card above the first).
  await drag(
    window,
    window.getByRole('button', { name: /Préparer la démo/ }),
    window.getByRole('button', { name: /Relire le contrat/ }),
    { x: 140, y: 6 },
  );
  await expect.poll(() => cardTitles(window, 'À faire')).toEqual(['Préparer la démo', 'Relire le contrat']);

  // Keyboard: open a card and close it with Escape, the focus comes back to the card;
  // ⌥/Alt + → then moves it to the next column, the help bar shows.
  await window.getByRole('button', { name: /Relire le contrat/ }).click();
  await expect(window.getByRole('dialog')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.getByRole('button', { name: /Relire le contrat/ })).toBeFocused();
  await window.keyboard.press('Alt+ArrowRight');
  await expect
    .poll(() => cardTitles(window, 'En cours'))
    .toEqual(['Mettre à jour les dépendances', 'Relire le contrat']);
  await expect(window.getByRole('button', { name: /Relire le contrat/ })).toBeFocused();
  await expect(window.getByText('1 carte sélectionnée')).toBeVisible();
  await window.keyboard.press('Alt+ArrowUp');
  await expect
    .poll(() => cardTitles(window, 'En cours'))
    .toEqual(['Relire le contrat', 'Mettre à jour les dépendances']);
  await window.screenshot({ path: 'test-results/dnd-keyboard.png' });

  // Keyboard: ⌥/Alt + ← on the "Terminé" header moves the column before "En cours".
  await window.getByRole('region', { name: 'Terminé' }).locator('[tabindex="0"]').first().focus();
  await window.keyboard.press('Alt+ArrowLeft');
  const columnOrder = () =>
    window.locator('section[data-column-id]').evaluateAll((s) => s.map((e) => e.getAttribute('aria-label')));
  await expect.poll(columnOrder).toEqual(['À faire', 'Terminé', 'En cours']);

  // Everything is saved.
  await app.close();
  app = await launch(dataDir);
  window = await app.firstWindow();
  await expect.poll(columnOrder).toEqual(['À faire', 'Terminé', 'En cours']);
  await expect.poll(() => cardTitles(window, 'À faire')).toEqual(['Préparer la démo']);
  await expect
    .poll(() => cardTitles(window, 'En cours'))
    .toEqual(['Relire le contrat', 'Mettre à jour les dépendances']);

  await app.close();
});
