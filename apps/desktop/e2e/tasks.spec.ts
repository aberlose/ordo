import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

const launch = (dataDir: string) =>
  electron.launch({
    args: [fileURLToPath(new URL('..', import.meta.url))],
    env: { ...process.env, ORDO_USER_DATA: dataDir },
  });

test('quick add, edit in the detail window, persist, delete', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let window = await app.firstWindow();

  await window.getByRole('button', { name: /Créer un board vide/ }).click();
  const todo = window.getByRole('region', { name: 'À faire' });

  // Quick add two tasks with the keyboard; the field stays open between them.
  await todo.getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  const field = window.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  await field.fill('Relire le contrat');
  await field.press('Enter');
  await field.fill('Préparer la démo');
  await field.press('Enter');
  await field.press('Escape');
  await expect(todo.getByRole('button', { name: /Relire le contrat/ })).toBeVisible();
  await expect(todo.getByRole('button', { name: /Préparer la démo/ })).toBeVisible();
  await window.screenshot({ path: 'test-results/tasks-board.png' });

  // Open the detail window, change priority, status and due date.
  await todo.getByRole('button', { name: /Relire le contrat/ }).click();
  const detail = window.getByRole('dialog');
  await expect(detail.getByRole('textbox', { name: 'Titre de la tâche' })).toHaveValue('Relire le contrat');
  await detail.getByRole('radio', { name: 'Très haute' }).click();
  await detail
    .getByRole('button', { name: /Échéance|Aucune date/ })
    .last()
    .click();
  await window.getByRole('button', { name: /Dans 1 semaine/ }).click();
  await detail.getByRole('button', { name: /À faire/ }).click();
  await window.getByRole('menuitemradio', { name: /En cours/ }).click();
  await window.screenshot({ path: 'test-results/task-detail.png' });
  await detail.getByRole('button', { name: 'Fermer' }).click();
  await expect(detail).toBeHidden();

  const doing = window.getByRole('region', { name: 'En cours' });
  await expect(doing.getByRole('button', { name: /Relire le contrat/ })).toBeVisible();
  await expect(doing.getByRole('img', { name: 'Priorité : Très haute' })).toBeVisible();

  // Everything is saved: restart and check.
  await app.close();
  app = await launch(dataDir);
  window = await app.firstWindow();
  const doingAgain = window.getByRole('region', { name: 'En cours' });
  await expect(doingAgain.getByRole('button', { name: /Relire le contrat/ })).toBeVisible();
  await expect(doingAgain.getByRole('img', { name: 'Priorité : Très haute' })).toBeVisible();

  // Delete from the ⋯ menu.
  await doingAgain.getByRole('button', { name: /Relire le contrat/ }).click();
  await window.getByRole('dialog').getByRole('button', { name: "Plus d'actions" }).click();
  await window.getByRole('menuitem', { name: 'Supprimer la tâche' }).click();
  await expect(window.getByRole('dialog')).toBeHidden();
  await expect(window.getByRole('button', { name: /Relire le contrat/ })).toHaveCount(0);
  await expect(window.getByText('1 tâche')).toBeVisible();

  await app.close();
});
