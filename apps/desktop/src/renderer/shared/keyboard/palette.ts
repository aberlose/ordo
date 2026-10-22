import { create } from 'zustand';

/**
 * Whether the command palette is open, and the query it opens with. Shared so the sidebar's search
 * button, the filter bar's "ou tapez un filtre ⌘K" and the global shortcuts can open it without
 * importing the command-palette feature.
 */
interface PaletteState {
  open: boolean;
  /** Query the palette starts with (cleared once read by the palette). */
  initialQuery: string;
  openPalette: (initialQuery?: string) => void;
  closePalette: () => void;
}

export const usePalette = create<PaletteState>((set) => ({
  open: false,
  initialQuery: '',
  openPalette: (initialQuery = '') => set({ open: true, initialQuery }),
  closePalette: () => set({ open: false, initialQuery: '' }),
}));
