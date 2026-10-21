import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OrdoApi } from '@ordo/contracts';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

const launch = (dataDir: string) =>
  electron.launch({
    args: [fileURLToPath(new URL('..', import.meta.url))],
    env: { ...process.env, ORDO_USER_DATA: dataDir },
  });

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const cards = (page: Page) => page.locator('main [data-task-id]');

test('filter the board, search across boards from the palette, and reopen a recent task', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();
  await expect(page.getByRole('region', { name: 'À faire' })).toBeVisible();

  // Seed through the API, then restart so every query starts from the database.
  await page.evaluate(async () => {
    const { api } = globalThis as unknown as { api: OrdoApi };
    const unwrap = <T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }) => {
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    };
    const [board] = unwrap(await api.invoke('boards.list', {}));
    const detail = unwrap(await api.invoke('boards.get', { id: board!.id }));
    const todo = detail.columns[0]!.id;
    const header = unwrap(await api.invoke('tasks.create', { columnId: todo, title: 'Intégrer le nouveau header' }));
    await api.invoke('tasks.update', { id: header.id, priority: 5 });
    unwrap(await api.invoke('tasks.create', { columnId: todo, title: 'Maquetter la page tarifs' }));
    const notes = unwrap(await api.invoke('tasks.create', { columnId: todo, title: 'Revoir le pied de page' }));
    unwrap(
      await api.invoke('tasks.updateDescription', {
        id: notes.id,
        json: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aligner avec le Héadér du site' }] }],
        },
      }),
    );
    const other = unwrap(
      await api.invoke('boards.create', { name: 'Veille tech', columnNames: ['À lire', 'En cours', 'Lu'] }),
    );
    unwrap(await api.invoke('tasks.create', { columnId: other.columns[0]!.id, title: 'Sticky headers done right' }));
  });
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect(cards(page)).toHaveCount(3);

  // Typed filters in the palette: the board previews them live, Enter applies them.
  await page.keyboard.press(`${mod}+K`);
  const palette = page.getByRole('dialog', { name: 'Palette de commandes' });
  await palette.getByRole('combobox').fill('header');
  await expect(palette.getByText('Ce board · Mon premier board · 2', { exact: false })).toBeVisible();
  await expect(palette.getByText('Autres boards · 1')).toBeVisible();
  await expect(palette.getByText('Veille tech · À lire')).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await page.keyboard.press('Enter');
  await expect(palette).toHaveCount(0);
  await expect(page.getByText('Texte : « header »')).toBeVisible();
  await expect(page.getByText('2 sur 3 tâches')).toBeVisible();

  // Priority words combine with the text; then clear everything in one click.
  await page.keyboard.press(`${mod}+K`);
  await palette.getByRole('combobox').fill('haute header');
  await expect(palette.getByText('Priorité ≥ Haute')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('Intégrer le nouveau header');
  await page.getByRole('button', { name: 'Effacer les filtres' }).click();
  await expect(cards(page)).toHaveCount(3);

  // Filter buttons: the priority menu.
  await page.getByRole('button', { name: /Priorité/ }).first().click();
  await page.getByRole('menuitemcheckbox', { name: /Très haute/ }).click();
  await page.keyboard.press('Escape');
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Effacer les filtres' }).click();

  // A task of another board: arrow down to it, Enter switches board and opens it.
  await page.keyboard.press(`${mod}+K`);
  await palette.getByRole('combobox').fill('sticky');
  await palette.getByRole('option', { name: /Sticky headers done right/ }).click();
  await expect(palette).toHaveCount(0);
  const detail = page.getByRole('dialog').first();
  await expect(detail.getByRole('textbox', { name: /Titre/ })).toHaveValue('Sticky headers done right');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: 'Veille tech' })).toBeVisible();

  // Recently opened survives a restart.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect(cards(page).first()).toBeVisible();
  await page.keyboard.press(`${mod}+K`);
  await expect(page.getByText('Récemment ouvertes')).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Palette de commandes' }).getByRole('option', { name: /Sticky headers done right/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await app.close();
});
