import { mkdtempSync, writeFileSync } from 'node:fs';
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

const card = (page: Page) => page.getByRole('region', { name: 'À faire' }).locator('[data-task-id]').first();

test('write rich notes, attach a file, delete it, and keep everything after a restart', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  const fileDir = mkdtempSync(join(tmpdir(), 'ordo-files-'));
  const pdf = join(fileDir, 'cahier-des-charges.pdf');
  writeFileSync(pdf, '%PDF-1.4 cahier des charges');
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();

  const todo = page.getByRole('region', { name: 'À faire' });
  await todo.getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  const quickAdd = page.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  await quickAdd.fill('Intégrer le nouveau header');
  await quickAdd.press('Enter');
  await quickAdd.press('Escape');
  const taskId = await card(page).getAttribute('data-task-id');
  await card(page).click();
  const detail = page.getByRole('dialog').first();

  // Notes: Markdown shortcuts, then the autosave.
  const notes = detail.getByRole('textbox', { name: 'Notes' });
  await notes.click();
  await page.keyboard.type('## Points d’attention');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- Header sticky sur la page produit');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Hauteur de 64 px');
  await expect(notes.locator('h2')).toHaveText('Points d’attention');
  await expect(notes.locator('ul li')).toHaveCount(2);
  await expect(detail.getByText('Enregistré')).toBeVisible();

  // Attach a file as a drop would (through the API: the native drop cannot be simulated).
  await page.evaluate(
    async ({ taskId, path }) => {
      const { api } = globalThis as unknown as { api: OrdoApi };
      const result = await api.invoke('attachments.add', { taskId: taskId!, paths: [path] });
      if (!result.ok || result.data.attachments.length !== 1) throw new Error('attachments.add failed');
    },
    { taskId, path: pdf },
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Restart: the card counts the file; the notes and the file are in the window.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect(card(page).getByText('1', { exact: true })).toBeVisible();
  await card(page).click();
  const reopened = page.getByRole('dialog').first();
  const saved = reopened.getByRole('textbox', { name: 'Notes' });
  await expect(saved.locator('h2')).toHaveText('Points d’attention');
  await expect(saved.locator('ul li').first()).toHaveText('Header sticky sur la page produit');

  // Delete the file after the confirmation.
  await reopened.getByText('cahier-des-charges.pdf').hover();
  await reopened.getByRole('button', { name: 'Actions de cahier-des-charges.pdf' }).click();
  await page.getByRole('menuitem', { name: /Supprimer/ }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Supprimer « cahier-des-charges.pdf » ?');
  await expect(confirm.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect(reopened.getByText('cahier-des-charges.pdf')).toHaveCount(0);
  await app.close();
});
