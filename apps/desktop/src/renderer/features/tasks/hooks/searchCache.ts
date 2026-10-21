import type { QueryClient } from '@tanstack/react-query';
import { searchKeys } from '@renderer/shared/api/keys';

/**
 * The full-text results may have changed (title, notes, tags, a task created or deleted): every
 * search result is refetched when next shown (board filters at once, the palette when it opens).
 */
export function refreshSearch(client: QueryClient) {
  void client.invalidateQueries({ queryKey: searchKeys.all });
}
