/**
 * Rows per multi-row INSERT. SQLite caps the bound variables of one statement (32,766 in the
 * bundled build): one row binds one variable per column, so 500 rows of the widest table (task,
 * 17 columns) stay far below the cap.
 */
export const INSERT_CHUNK_ROWS = 500;

/** Splits `rows` into slices of at most `size` rows, in order. */
export function chunked<T>(rows: readonly T[], size = INSERT_CHUNK_ROWS): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}
