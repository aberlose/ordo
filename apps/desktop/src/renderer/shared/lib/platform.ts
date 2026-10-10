/** Modifier key label for shortcuts: ⌘ on macOS, Ctrl+ elsewhere. */
export function modKey(): string {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
}
