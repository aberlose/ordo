import type { KeyboardEvent } from 'react';

/**
 * Arrow-key navigation for a `role="radiogroup"` of buttons with a roving tabindex: the arrows move
 * to the next radio and select it, wrapping at the ends (WAI-ARIA radio group). `columns` > 1 makes
 * ↑↓ move by rows; a grid stops at its first and last row instead of wrapping.
 */
export function radioGroupKeyDown(event: KeyboardEvent<HTMLElement>, columns = 1): void {
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const current = radios.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;
  const steps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  };
  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = radios.length - 1;
  else if (event.key in steps) next = current + (steps[event.key] ?? 0);
  else return;
  event.preventDefault();
  const radio =
    columns > 1 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ? radios[next]
      : radios[(next + radios.length) % radios.length];
  if (!radio || radio === radios[current]) return;
  radio.focus();
  radio.click();
}
