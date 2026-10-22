import { useEffect } from 'react';
import { useAppearance } from '@renderer/shared/appearance/store';
import { usePalette } from '@renderer/shared/keyboard/palette';
import { useLayout } from '@renderer/shared/layout/store';
import { isMac } from '@renderer/shared/lib/platform';

/** ⌘ on macOS, Ctrl elsewhere (and not both). */
function isMod(event: KeyboardEvent): boolean {
  return isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Inside the notes editor, ⌘/Ctrl + K inserts a link (user decision), it does not open the palette. */
function inRichText(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('[contenteditable="true"], .ProseMirror') !== null)
  );
}

/** A dialog, popover or menu is open: "/" is then left to it. */
const overlayOpen = () =>
  document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null;

export function toggleTheme(): void {
  const dark = document.documentElement.dataset['mode'] === 'dark';
  useAppearance.getState().setMode(dark ? 'light' : 'dark');
}

/**
 * App-wide shortcuts (approved mockups command-palette and search-palette): ⌘/Ctrl + K toggles the
 * palette, "/" opens it outside text fields, ⇧⌘L / Ctrl + Shift + L toggles light and dark, ⌘\ / Ctrl + \
 * toggles the sidebar. Returns whether the event was handled (its default is then prevented).
 */
export function handleGlobalKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  const mod = isMod(event);
  const key = event.key.toLowerCase();
  let run: (() => void) | null = null;
  if (mod && !event.altKey && !event.shiftKey && key === 'k') {
    if (inRichText(event.target)) return false;
    run = () => {
      const palette = usePalette.getState();
      if (palette.open) palette.closePalette();
      else palette.openPalette();
    };
  } else if (mod && event.shiftKey && !event.altKey && key === 'l') {
    run = toggleTheme;
  } else if (mod && (event.key === '\\' || event.code === 'Backslash')) {
    run = () => useLayout.getState().toggleSidebar();
  } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (isTyping(event.target) || overlayOpen() || usePalette.getState().open) return false;
    run = () => usePalette.getState().openPalette();
  }
  if (!run) return false;
  event.preventDefault();
  run();
  return true;
}

/** Installs the app-wide shortcuts (one listener, mounted once in the layout). */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => void handleGlobalKey(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
