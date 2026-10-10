import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

export const PALETTES = ['ciel', 'aurore', 'lavande', 'indigo', 'corail'] as const;
export type Palette = (typeof PALETTES)[number];
export type Mode = 'light' | 'dark' | 'system';

interface AppearanceState {
  palette: Palette;
  mode: Mode;
  setPalette: (palette: Palette) => void;
  setMode: (mode: Mode) => void;
}

/** Ephemeral for now; persisted in the `setting` table once the settings feature lands. */
export const useAppearance = create<AppearanceState>((set) => ({
  palette: 'ciel',
  mode: 'system',
  setPalette: (palette) => set({ palette }),
  setMode: (mode) => set({ mode }),
}));

const darkQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply({ palette, mode }: Pick<AppearanceState, 'palette' | 'mode'>): void {
  const dark = mode === 'dark' || (mode === 'system' && darkQuery()?.matches === true);
  document.documentElement.dataset['palette'] = palette;
  document.documentElement.dataset['mode'] = dark ? 'dark' : 'light';
}

/** Keeps <html data-palette data-mode> in sync with the store and the OS setting. */
export function bindAppearance(): () => void {
  apply(useAppearance.getState());
  const unsubscribe = useAppearance.subscribe(apply);
  const query = darkQuery();
  const onChange = () => apply(useAppearance.getState());
  query?.addEventListener('change', onChange);
  return () => {
    unsubscribe();
    query?.removeEventListener('change', onChange);
  };
}

function resolvedMode(): 'light' | 'dark' {
  return document.documentElement.dataset['mode'] === 'dark' ? 'dark' : 'light';
}

/** The mode actually displayed ("system" resolved), kept in sync with <html data-mode>. */
export function useResolvedMode(): 'light' | 'dark' {
  return useSyncExternalStore((onChange) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
    return () => observer.disconnect();
  }, resolvedMode);
}
