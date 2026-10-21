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

test('notes typed just before closing the app are saved', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  let app: ElectronApplication = await launch(dataDir);
  let page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();
  const todo = page.getByRole('region', { name: 'À faire' });
  await todo.getByRole('button', { name: 'Ajouter une tâche', exact: true }).click();
  const quickAdd = page.getByRole('textbox', { name: 'Titre de la nouvelle tâche' });
  await quickAdd.fill('Fermer vite');
  await quickAdd.press('Enter');
  await quickAdd.press('Escape');
  await card(page).click();
  const notes = page.getByRole('dialog').first().getByRole('textbox', { name: 'Notes' });
  // Silence the page's own `beforeunload` fallback (a capture listener on window runs first at the
  // target): only the main process's flush on `close` can save the text in time.
  await page.evaluate(() => {
    // Typed without the DOM library: the page's window, described structurally.
    const win = globalThis as unknown as {
      addEventListener(
        type: string,
        listener: (event: { stopImmediatePropagation(): void }) => void,
        capture: boolean,
      ): void;
    };
    win.addEventListener('beforeunload', (event) => event.stopImmediatePropagation(), true);
  });
  await notes.click();
  await page.keyboard.type('Écrit juste avant de quitter', { delay: 0 });

  // Quit at once, well inside the autosave's debounce: the main process asks the page to flush.
  const typed = Date.now();
  await app.close();
  expect(Date.now() - typed).toBeLessThan(3_000);

  app = await launch(dataDir);
  page = await app.firstWindow();
  await card(page).click();
  await expect(page.getByRole('dialog').first().getByRole('textbox', { name: 'Notes' })).toHaveText(
    'Écrit juste avant de quitter',
  );
  await app.close();
});

/** A 1×1 PNG. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('a pasted image crosses IPC, is served to the page, and is copied with its board', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ordo-e2e-'));
  const app = await launch(dataDir);
  const page = await app.firstWindow();
  await page.getByRole('button', { name: /Créer un board vide/ }).click();
  await expect(page.getByRole('region', { name: 'À faire' })).toBeVisible();

  const result = await page.evaluate(async (base64) => {
    const { api } = globalThis as unknown as { api: OrdoApi };
    const unwrap = <T>(
      r: { ok: true; data: T } | { ok: false; error: { code: string; message: string } },
    ) => {
      if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
      return r.data;
    };
    const loads = (src: string) =>
      new Promise<number>((resolve, reject) => {
        // The e2e files are typed without the DOM library: the page's Image, described structurally.
        type PageImage = {
          onload: (() => void) | null;
          onerror: (() => void) | null;
          src: string;
          naturalWidth: number;
        };
        const image = new (globalThis as unknown as { Image: new () => PageImage }).Image();
        image.onload = () => resolve(image.naturalWidth);
        image.onerror = () => reject(new Error(`${src} did not load`));
        image.src = src;
      });

    const [board] = unwrap(await api.invoke('boards.list', {}));
    const detail = unwrap(await api.invoke('boards.get', { id: board!.id }));
    const task = unwrap(
      await api.invoke('tasks.create', { columnId: detail.columns[0]!.id, title: 'Capture' }),
    );
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const image = unwrap(
      await api.invoke('attachments.addData', {
        taskId: task.id,
        fileName: 'capture.svg',
        mimeType: 'image/png',
        bytes,
      }),
    );
    const svg = await api.invoke('attachments.addData', {
      taskId: task.id,
      fileName: 'x.svg',
      mimeType: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    const width = await loads(image.url);

    const copy = unwrap(
      await api.invoke('boards.duplicate', { id: board!.id, name: 'Copie', includeTasks: true }),
    );
    const copied = unwrap(await api.invoke('boards.get', { id: copy.id }));
    const copiedFiles = unwrap(await api.invoke('attachments.list', { taskId: copied.tasks[0]!.id }));
    const copiedWidth = await loads(copiedFiles[0]!.url);
    return {
      image: { fileName: image.fileName, mimeType: image.mimeType, sizeBytes: image.sizeBytes },
      svg: svg.ok ? 'accepted' : svg.error.code,
      width,
      copied: copiedFiles.map((f) => ({ fileName: f.fileName, isNew: f.id !== image.id })),
      copiedWidth,
    };
  }, PNG_BASE64);

  expect(result).toEqual({
    image: {
      fileName: 'capture.png',
      mimeType: 'image/png',
      sizeBytes: Buffer.from(PNG_BASE64, 'base64').length,
    },
    svg: 'invalid_input',
    width: 1,
    copied: [{ fileName: 'capture.png', isNew: true }],
    copiedWidth: 1,
  });
  await app.close();
});
