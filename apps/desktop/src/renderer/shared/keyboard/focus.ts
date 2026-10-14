import type { FocusEvent } from 'react';
import { create } from 'zustand';

/** What has keyboard focus on the board, to show the matching help bar (mockup drag-and-drop/KeyboardMove B). */
export type KeyboardTarget = 'card' | 'column' | null;

export const useKeyboardTarget = create<{ target: KeyboardTarget; set: (target: KeyboardTarget) => void }>(
  (set) => ({ target: null, set: (target) => set({ target }) }),
);

// Keyboard or pointer: the last kind of input decides whether a focus came from the keyboard.
let usingKeyboard = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (usingKeyboard = true), true);
  window.addEventListener('pointerdown', () => (usingKeyboard = false), true);
}

/** Focus handlers for an element that shows the help bar while it has keyboard (not mouse) focus. */
export function keyboardTargetHandlers(target: Exclude<KeyboardTarget, null>) {
  return {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget !== event.target) return;
      if (usingKeyboard || event.currentTarget.matches(':focus-visible')) {
        useKeyboardTarget.getState().set(target);
      }
    },
    onBlur: () => useKeyboardTarget.getState().set(null),
  };
}
