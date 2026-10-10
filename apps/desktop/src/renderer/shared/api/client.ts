import type { Channel, ErrorCode, Input, Output } from '@ordo/contracts';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Typed call through the preload bridge; turns `{ ok: false }` results into thrown ApiErrors for TanStack Query. */
export async function call<C extends Channel>(channel: C, input: Input<C>): Promise<Output<C>> {
  const result = await window.api.invoke(channel, input);
  if (!result.ok) throw new ApiError(result.error.code, result.error.message);
  return result.data;
}
