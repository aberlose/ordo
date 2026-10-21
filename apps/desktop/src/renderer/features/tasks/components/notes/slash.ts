import type { SuggestionProps } from '@tiptap/suggestion';
import type { Block } from './helpers';

/** State of the "/" menu, shared by the suggestion plugin (writes) and `SlashMenu` (reads). */
export interface SlashState {
  readonly open: boolean;
  readonly items: readonly Block[];
  readonly index: number;
  /** Where the menu goes (under the "/"), relative to the notes; `null` when it cannot be placed. */
  readonly position: { readonly left: number; readonly top: number } | null;
  readonly select: ((block: Block) => void) | null;
}

const CLOSED: SlashState = { open: false, items: [], index: 0, position: null, select: null };

export type SlashStore = ReturnType<typeof createSlashStore>;

/**
 * A small external store (useSyncExternalStore): one per editor. `place` turns the caret's viewport
 * rectangle into the menu's position in the notes.
 */
export function createSlashStore(initial: SlashState = CLOSED) {
  let state = initial;
  let place: (caret: DOMRect) => SlashState['position'] = () => null;
  const listeners = new Set<() => void>();
  const set = (next: SlashState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const choose = (index: number) => {
    const block = state.items[index];
    if (block && state.select) state.select(block);
  };
  return {
    get: () => state,
    /** Set by the editor once its notes are in the page. */
    setPlace(fn: typeof place) {
      place = fn;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(props: SuggestionProps<Block, Block>) {
      const sameItems =
        state.open &&
        state.items.length === props.items.length &&
        state.items.every((b, i) => b.id === props.items[i]?.id);
      const caret = props.clientRect?.() ?? null;
      set({
        open: true,
        items: props.items,
        index: sameItems ? Math.min(state.index, Math.max(0, props.items.length - 1)) : 0,
        position: caret ? place(caret) : null,
        select: props.command,
      });
    },
    close: () => set(CLOSED),
    highlight: (index: number) => set({ ...state, index }),
    choose,
    /** ↑ ↓ move, Enter (or Tab) inserts; Escape is handled by the plugin (it closes the menu). */
    keyDown(event: KeyboardEvent): boolean {
      if (!state.open) return false;
      const count = state.items.length;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (count === 0) return true;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        set({ ...state, index: (state.index + step + count) % count });
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (count === 0) return false;
        choose(state.index);
        return true;
      }
      return false;
    },
  };
}
