import type { WebContents } from 'electron';

/** Window helpers without Electron at runtime (unit-tested). */

/** Whether `url` has the origin of `base` (scheme, host and port): never a look-alike prefix. */
export function isSameOrigin(url: string, base: string): boolean {
  try {
    const origin = new URL(url).origin;
    // Opaque origins (`file:`, custom schemes) are the string "null": never equal to anything.
    return origin !== 'null' && origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** How long a closing window waits for the renderer to save the notes being typed. */
export const FLUSH_ON_CLOSE_TIMEOUT_MS = 2_000;

/**
 * Asks the renderer to save what is pending (the notes' debounced autosave) and waits for it, at most
 * `timeoutMs`. Never rejects: a renderer that is gone, hung or without the hook just lets the close go.
 */
export async function flushRenderer(
  contents: Pick<WebContents, 'executeJavaScript' | 'isDestroyed'>,
  timeoutMs: number = FLUSH_ON_CLOSE_TIMEOUT_MS,
): Promise<void> {
  if (contents.isDestroyed()) return;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([
      // Defined by the renderer; resolves once the pending saves are done (no IPC channel needed).
      contents.executeJavaScript('window.__ordoFlushNotes?.()', true).then(
        () => undefined,
        (error: unknown) => console.warn('[window] could not flush the notes before closing', error),
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
