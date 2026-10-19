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

const card = (page: Page) => page.getByRole('region', { name: 'À faire' }).locator('[data-task-id]').first();

test('tag a task, manage a tag, add, check and open sub-tasks', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();

  const todo = page.getByRole('region', { name: 'À faire' });
  await todo.getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  const quickAdd = page.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  await quickAdd.fill('Intégrer le nouveau header');
  await quickAdd.press('Enter');
  await quickAdd.press('Escape');
  await card(page).click();
  const detail = page.getByRole('dialog').first();
  await expect(detail.getByRole('textbox', { name: 'Titre de la tâche' })).toHaveValue(
    'Intégrer le nouveau header',
  );

  // Tags: create two from the picker, the second with the keyboard.
  await detail.getByRole('button', { name: 'Ajouter un tag' }).click();
  const search = page.getByRole('combobox', { name: 'Rechercher ou créer un tag' });
  await expect(search).toBeFocused();
  await search.fill('front');
  await page.getByRole('option', { name: /Créer « front »/ }).click();
  await search.fill('design');
  await search.press('Enter');
  await expect(page.getByRole('option', { name: /front/ })).toHaveAttribute('aria-selected', 'true');
  await search.press('Escape');
  await expect(search).toBeHidden();
  await expect(detail.getByRole('button', { name: 'Retirer front' })).toBeAttached();
  await expect(detail.getByRole('button', { name: 'Retirer design' })).toBeAttached();

  // Manage: rename "design", then delete it after the confirmation.
  await detail.getByRole('button', { name: 'Ajouter un tag' }).click();
  await page.getByRole('button', { name: 'Gérer le tag design' }).click({ force: true });
  const name = page.getByRole('textbox', { name: 'Nom' });
  await name.fill('design UI');
  await name.press('Enter');
  await page.getByRole('button', { name: 'Supprimer le tag' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Supprimer « design UI » ? Il sera retiré de 1 tâche.');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('option', { name: /design/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(detail.getByRole('button', { name: 'Retirer design UI' })).toHaveCount(0);

  // Sub-tasks: add two from the empty state, the field stays open between them.
  await detail.getByRole('button', { name: 'Ajouter une sous-tâche' }).click();
  const subField = detail.getByRole('textbox', { name: 'Titre de la sous-tâche' });
  await subField.fill('Logo SVG optimisé');
  await subField.press('Enter');
  await subField.fill('Menu burger mobile');
  await subField.press('Enter');
  await subField.press('Escape');

  // Checking sends the sub-task to the Done column.
  await detail.getByRole('checkbox', { name: 'Sous-tâche terminée : Logo SVG optimisé' }).click();
  await expect(
    detail.getByRole('checkbox', { name: 'Sous-tâche terminée : Logo SVG optimisé' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(detail.getByText('1/2', { exact: true })).toBeVisible();

  // Open a sub-task, then go back to its parent.
  await detail.getByRole('button', { name: /^Menu burger mobile/ }).click();
  const back = page.getByRole('button', { name: /^Sous-tâche de « Intégrer le nouveau header »/ });
  await expect(back).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Titre de la tâche' })).toHaveValue('Menu burger mobile');
  await back.click();
  await expect(page.getByRole('textbox', { name: 'Titre de la tâche' })).toHaveValue(
    'Intégrer le nouveau header',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The card shows the tag and the sub-task progress, also after a restart.
  await expect(card(page)).toContainText('front');
  await expect(card(page)).toContainText('1/2');
  await app.close();
  app = await launch(dataDir);
  page = await app.firstWindow();
  await expect(card(page)).toContainText('front');
  await expect(card(page)).not.toContainText('design');
  await expect(card(page)).toContainText('1/2');
  // Sub-tasks are not cards of the board.
  await expect(page.locator('[data-task-id]')).toHaveCount(1);
  await app.close();
});
