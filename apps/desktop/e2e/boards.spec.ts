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

/** Native drag and drop needs several pointer moves for dragover events. */
async function drag(page: Page, from: Locator, to: Locator, offsetY: number) {
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  await page.mouse.move(start.x + 40, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 48, start.y + start.height / 2 + 6, { steps: 4 });
  await page.mouse.move(end.x + 40, end.y + offsetY, { steps: 16 });
  await page.mouse.up();
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Boards' });
const boardNames = (page: Page) =>
  sidebar(page).locator('[data-board-id] > button:first-child > span.flex-1').allInnerTexts();
const row = (page: Page, name: string) =>
  sidebar(page).locator('[data-board-id]', { has: page.locator(`span.flex-1:text-is("${name}")`) });
const openMenu = async (page: Page, name: string) => {
  await row(page, name).hover();
  await page.getByRole('button', { name: `Actions du board ${name}` }).click();
  return page.getByRole('menu');
};

test('create, rename, duplicate, reorder, archive and restore boards', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();
  await expect.poll(() => boardNames(page)).toEqual(['Mon premier board']);

  // A task, to be copied with the board.
  const todo = page.getByRole('region', { name: 'À faire' });
  await todo.getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  await field.fill('Relire le contrat');
  await field.press('Enter');
  await field.press('Escape');

  // Create a board from "+": it opens.
  await sidebar(page).getByRole('button', { name: 'Nouveau board' }).click();
  const create = page.getByRole('dialog', { name: 'Nouveau board' });
  await create.getByRole('textbox', { name: 'Nom' }).fill('Perso');
  await create.getByRole('radio', { name: 'Rose' }).click();
  await create.getByRole('button', { name: 'Créer le board' }).click();
  await expect(create).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Perso' })).toBeVisible();
  await expect.poll(() => boardNames(page)).toEqual(['Mon premier board', 'Perso']);

  // Rename with F2.
  await row(page, 'Perso').locator('> button').first().focus();
  await page.keyboard.press('F2');
  const rename = sidebar(page).getByRole('textbox', { name: 'Nom du board' });
  await rename.fill('Maison');
  await rename.press('Enter');
  await expect.poll(() => boardNames(page)).toEqual(['Mon premier board', 'Maison']);

  // Duplicate with its tasks: the copy goes right after the original.
  let menu = await openMenu(page, 'Mon premier board');
  await menu.getByRole('menuitem', { name: 'Dupliquer…' }).click();
  const duplicate = page.getByRole('dialog', { name: 'Dupliquer « Mon premier board »' });
  await expect(duplicate.getByRole('textbox', { name: 'Nom de la copie' })).toHaveValue(
    'Mon premier board (copie)',
  );
  await expect(duplicate.getByRole('checkbox', { name: 'Inclure la tâche' })).toBeChecked();
  await duplicate.getByRole('button', { name: 'Dupliquer' }).click();
  await expect
    .poll(() => boardNames(page))
    .toEqual(['Mon premier board', 'Mon premier board (copie)', 'Maison']);
  await row(page, 'Mon premier board (copie)').locator('> button').first().click();
  await expect(page.getByText('Relire le contrat')).toBeVisible();

  // Keyboard reorder: ⌥/Alt + ↓ moves the focused board down.
  const copy = row(page, 'Mon premier board (copie)').locator('> button').first();
  await copy.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect
    .poll(() => boardNames(page))
    .toEqual(['Mon premier board', 'Maison', 'Mon premier board (copie)']);
  await expect(copy).toBeFocused();

  // Drag "Maison" above the first board.
  await drag(page, row(page, 'Maison'), row(page, 'Mon premier board'), 4);
  await expect
    .poll(() => boardNames(page))
    .toEqual(['Maison', 'Mon premier board', 'Mon premier board (copie)']);

  // Archive the open board: no confirmation, the next board opens (here the previous one, as it was last).
  menu = await openMenu(page, 'Mon premier board (copie)');
  await menu.getByRole('menuitem', { name: 'Archiver' }).click();
  await expect.poll(() => boardNames(page)).toEqual(['Maison', 'Mon premier board']);
  await expect(page.getByRole('heading', { level: 1, name: 'Mon premier board' })).toBeVisible();

  // The order and the archive survive a restart.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect.poll(() => boardNames(page)).toEqual(['Maison', 'Mon premier board']);

  // Restore from the Archives page: the board goes to the end of the sidebar.
  await sidebar(page).getByRole('button', { name: 'Archives' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Archives' })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurer « Mon premier board (copie) »' }).click();
  await expect(page.getByText('Aucun board archivé')).toBeVisible();
  await expect
    .poll(() => boardNames(page))
    .toEqual(['Maison', 'Mon premier board', 'Mon premier board (copie)']);
  await app.close();
});
