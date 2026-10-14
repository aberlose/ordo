import { create } from 'zustand';

export interface Toast {
  readonly id: number;
  readonly message: string;
  /** Runs the failed action again. */
  readonly retry?: () => void;
}

interface FeedbackState {
  /** One toast at a time (approved mockup: drag-and-drop/Toast A). */
  toast: Toast | null;
  /** Polite screen-reader announcement (moves, …). */
  announcement: string;
  /** Open modal windows: the toast then renders inside the top one, the rest of the app being inert. */
  modals: number;
  showToast: (message: string, retry?: () => void) => void;
  dismissToast: () => void;
  announce: (message: string) => void;
  enterModal: () => void;
  leaveModal: () => void;
}

let nextId = 0;
let announceTimer: ReturnType<typeof setTimeout> | undefined;

/** Ephemeral user feedback shared by every feature. */
export const useFeedback = create<FeedbackState>((set) => ({
  toast: null,
  announcement: '',
  modals: 0,
  showToast: (message, retry) => set({ toast: { id: ++nextId, message, ...(retry ? { retry } : {}) } }),
  dismissToast: () => set({ toast: null }),
  // Clear first, then set: screen readers announce the same sentence twice in a row.
  announce: (message) => {
    clearTimeout(announceTimer);
    set({ announcement: '' });
    announceTimer = setTimeout(() => set({ announcement: message }), 50);
  },
  enterModal: () => set((state) => ({ modals: state.modals + 1 })),
  leaveModal: () => set((state) => ({ modals: Math.max(0, state.modals - 1) })),
}));
