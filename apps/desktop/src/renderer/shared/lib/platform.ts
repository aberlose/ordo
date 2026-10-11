/** Modifier key label for shortcuts: ⌘ on macOS, Ctrl+ elsewhere. */
export function modKey(): string {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
}

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

/** Alt key label: ⌥ on macOS, Alt elsewhere. */
export function altKey(): string {
  return isMac() ? '⌥' : 'Alt';
}
