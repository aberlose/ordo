import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

test('first launch creates an empty board with the default columns', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  const app = await electron.launch({
    args: [fileURLToPath(new URL('..', import.meta.url))],
    env: { ...process.env, ORDO_USER_DATA: dataDir },
  });
  const window = await app.firstWindow();

  await expect(window.getByRole('heading', { name: 'Bienvenue dans Ordo' })).toBeVisible();
  await window.screenshot({ path: 'test-results/first-launch.png' });

  await window.getByRole('button', { name: /Créer un board vide/ }).click();

  await expect(window.getByRole('heading', { level: 1, name: 'Mon premier board' })).toBeVisible();
  for (const column of ['À faire', 'En cours', 'Terminé']) {
    await expect(window.getByRole('region', { name: column })).toBeVisible();
  }
  await window.screenshot({ path: 'test-results/new-board.png' });

  await app.close();
});
