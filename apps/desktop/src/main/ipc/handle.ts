import { contract, fail, ok, type Channel, type Contract, type Output, type Result } from '@ordo/contracts';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { NotFoundError } from '../application/errors';

export type Handlers = {
  [C in Channel]: (input: z.output<Contract[C]['input']>) => Output<C> | Promise<Output<C>>;
};

async function dispatch<C extends Channel>(
  channel: C,
  handler: Handlers[C],
  raw: unknown,
): Promise<Result<Output<C>>> {
  const parsed = contract[channel].input.safeParse(raw);
  if (!parsed.success) {
    return fail(
      'invalid_input',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  try {
    return ok(await handler(parsed.data as never));
  } catch (error) {
    if (error instanceof NotFoundError) return fail('not_found', error.message);
    console.error(`[ipc] ${channel} failed`, error);
    return fail('internal', 'Unexpected error');
  }
}

/**
 * Registers one `ipcMain.handle` per channel. Calls are accepted only from the app's own top frame,
 * and every input is validated before reaching a use case.
 */
export function registerHandlers(
  ipcMain: Pick<IpcMain, 'handle'>,
  handlers: Handlers,
  trustedOrigin: () => string,
): void {
  const trusted = (event: IpcMainInvokeEvent) => {
    const frame = event.senderFrame;
    return frame !== null && frame.parent === null && frame.url.startsWith(trustedOrigin());
  };
  for (const channel of Object.keys(handlers) as Channel[]) {
    ipcMain.handle(channel, (event, raw: unknown) =>
      trusted(event)
        ? dispatch(channel, handlers[channel] as never, raw)
        : fail('invalid_input', 'Untrusted sender'),
    );
  }
}
