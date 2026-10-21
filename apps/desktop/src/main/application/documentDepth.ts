/**
 * Notes deeper than this (counted in nodes, the `doc` being 1) are refused: the domain's document
 * walkers (plain text, attachment ids, remapping on duplication) are recursive. Real notes stay far
 * below it (a table cell holding a list nested ten levels is under 20).
 */
export const DESCRIPTION_MAX_DEPTH = 64;

/**
 * Whether a ProseMirror JSON tree nests more than `max` nodes deep through `content`. Iterative (no
 * recursion, so any input is safe to check) and stops at the first node past the limit.
 */
export function exceedsNodeDepth(root: unknown, max: number): boolean {
  const stack: [unknown, number][] = [[root, 1]];
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const [node, depth] = next;
    if (typeof node !== 'object' || node === null) continue;
    if (depth > max) return true;
    const content = (node as { content?: unknown }).content;
    if (Array.isArray(content)) for (const child of content) stack.push([child, depth + 1]);
  }
  return false;
}
