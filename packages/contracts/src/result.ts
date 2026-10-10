export const ERROR_CODES = ['invalid_input', 'not_found', 'conflict', 'internal'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface IpcError {
  readonly code: ErrorCode;
  readonly message: string;
}

/** Errors cross the bridge as values, never as thrown Electron errors. */
export type Result<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: IpcError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});
