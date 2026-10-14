import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

const launch = (dataDir: string) =>
  electron.launch({
    args: [fileURLToPath(new URL('..', import.meta.url))],
    env: { ...process.env, ORDO_USER_DATA: dataDir },
  });

const columnNames = (page: Page) => page.locator('section[data-column-id] h2').allInnerTexts();
const cardTitles = (page: Page, column: string) =>
  page.getByRole('region', { name: column }).locator('[data-task-id] > span:first-child').allInnerTexts();

test('add a column, change its settings, show more and fold, then delete it', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();

  // Add "En revue" with the eye icon (searched without the ligature) and the violet colour.
  await page.getByRole('button', { name: 'Nouvelle colonne' }).click();
  let dialog = page.getByRole('dialog', { name: 'Nouvelle colonne' });
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('En revue');
  await dialog.getByRole('radio', { name: 'Violet' }).click();
  await dialog.getByRole('searchbox', { name: 'Rechercher une icône' }).fill('oeil');
  await dialog.getByRole('radio', { name: 'Œil' }).click();
  await dialog.getByRole('button', { name: 'Ajouter la colonne' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => columnNames(page)).toEqual(['À faire', 'En cours', 'Terminé', 'En revue']);

  // Show two tasks by default.
  await page.getByRole('button', { name: 'Réglages de la colonne En revue' }).click();
  dialog = page.getByRole('dialog', { name: 'Réglages de la colonne' });
  await dialog.getByRole('checkbox', { name: 'Aucune limite' }).uncheck();
  for (let i = 0; i < 8; i++)
    await dialog.getByRole('button', { name: 'Afficher une tâche de moins' }).click();
  await expect(dialog.getByText('Au-delà de 2 tâches')).toBeVisible();
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(dialog).toBeHidden();

  // Quick add past the limit expands the column, so the new task stays in sight.
  await page.getByRole('button', { name: 'Ajouter une tâche dans En revue' }).click();
  const field = page.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  for (const title of ['Relire le contrat', 'Préparer la démo', 'Tester l’export']) {
    await field.fill(title);
    await field.press('Enter');
  }
  await field.press('Escape');
  await expect.poll(() => cardTitles(page, 'En revue')).toHaveLength(3);

  const review = page.getByRole('region', { name: 'En revue' });
  await review.getByRole('button', { name: 'Replier En revue' }).click();
  await expect.poll(() => cardTitles(page, 'En revue')).toEqual(['Relire le contrat', 'Préparer la démo']);
  await review.getByRole('button', { name: 'Voir 1 de plus' }).click();
  await expect.poll(() => cardTitles(page, 'En revue')).toHaveLength(3);

  // Settings are saved; the expanded state is not.
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect.poll(() => cardTitles(page, 'En revue')).toHaveLength(2);
  await expect(
    page.getByRole('region', { name: 'En revue' }).getByRole('button', { name: 'Voir 1 de plus' }),
  ).toBeVisible();

  // Delete: the footer asks for confirmation, then the column and its tasks go.
  await page.getByRole('button', { name: 'Réglages de la colonne En revue' }).click();
  dialog = page.getByRole('dialog', { name: 'Réglages de la colonne' });
  await dialog.getByRole('button', { name: 'Supprimer' }).click();
  const confirm = dialog.getByRole('alertdialog');
  await expect(confirm).toContainText('Supprimer « En revue » et ses 3 tâches ?');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect.poll(() => columnNames(page)).toEqual(['À faire', 'En cours', 'Terminé']);
  // The focus goes to the previous column's header, as the deleted column was the last one.
  await expect(page.getByRole('group', { name: /^Terminé,/ })).toBeFocused();

  // Keyboard: the settings open with the name field focused; Escape closes them.
  await page.keyboard.press('Shift+Tab');
  await page.getByRole('button', { name: 'Réglages de la colonne Terminé' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Nom' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect.poll(() => columnNames(page)).toEqual(['À faire', 'En cours', 'Terminé']);
  await expect(page.getByText('Relire le contrat')).toHaveCount(0);
  await app.close();
});
