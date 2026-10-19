import { describe, expect, it, vi } from 'vitest';
import { flushRenderer, isSameOrigin } from './windowGuards';

describe('isSameOrigin', () => {
  it('matches the dev server by origin, not by prefix', () => {
    const server = 'http://localhost:5173';
    expect(isSameOrigin('http://localhost:5173/#/board/1', server)).toBe(true);
    expect(isSameOrigin('http://localhost:5173.evil.test/', server)).toBe(false);
    expect(isSameOrigin('http://localhost:51730/', server)).toBe(false);
    expect(isSameOrigin('https://localhost:5173/', server)).toBe(false);
    expect(isSameOrigin('http://localhost:5173@evil.test/', server)).toBe(false);
    expect(isSameOrigin('file:///index.html', 'file:///index.html')).toBe(false);
    expect(isSameOrigin('not a url', server)).toBe(false);
  });
});

describe('flushRenderer', () => {
  const contents = (run: () => Promise<unknown>, destroyed = false) => ({
    isDestroyed: () => destroyed,
    executeJavaScript: vi.fn(run),
  });

  it('waits for the renderer hook to finish', async () => {
    let done = false;
    const page = contents(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            done = true;
            resolve(undefined);
          }, 20),
        ),
    );
    await flushRenderer(page, 1_000);
    expect(done).toBe(true);
    expect(page.executeJavaScript).toHaveBeenCalledWith('window.__ordoFlushNotes?.()', true);
  });

  it('gives up after the timeout, and never rejects', async () => {
    const started = Date.now();
    await flushRenderer(
      contents(() => new Promise(() => undefined)),
      50,
    );
    expect(Date.now() - started).toBeLessThan(1_000);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      flushRenderer(
        contents(() => Promise.reject(new Error('crashed'))),
        50,
      ),
    ).resolves.toBe(undefined);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    const gone = contents(() => Promise.resolve());
    await flushRenderer({ ...gone, isDestroyed: () => true }, 50);
    expect(gone.executeJavaScript).not.toHaveBeenCalled();
  });
});
