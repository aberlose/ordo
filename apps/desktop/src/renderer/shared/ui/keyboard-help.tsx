import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useKeyboardTarget } from '../keyboard/focus';
import { altKey } from '../lib/platform';
import { Kbd } from './kbd';

const SELECTED = {
  card: 'dnd.help.cardSelected',
  column: 'dnd.help.columnSelected',
  board: 'sidebar.boardSelected',
} as const;

/**
 * The main area next to the sidebar (board, Archives, first launch) with the keyboard help bar
 * centred at its bottom, so focusing a sidebar board shows the bar on every page.
 */
export function MainArea({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-w-0 flex-1">
      {children}
      <KeyboardHelp />
    </div>
  );
}

/**
 * Help bar centred at the bottom of the main area while a card, a column header (approved mockup:
 * drag-and-drop/KeyboardMove B) or a sidebar board (boards/BoardReorder A) has keyboard focus.
 * Decorative for screen readers: cards, headers and boards carry the same hint in their description.
 */
export function KeyboardHelp() {
  const { t } = useTranslation();
  const target = useKeyboardTarget((state) => state.target);
  if (!target) return null;
  const alt = altKey();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-1.75 text-label whitespace-nowrap text-text-2 shadow-pop"
    >
      <span className="font-semibold text-text">{t(SELECTED[target])}</span>
      {target === 'board' ? (
        <>
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.order" values={{ alt }} components={{ kbd: <Kbd /> }} />
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.open" components={{ kbd: <Kbd /> }} />
        </>
      ) : target === 'card' ? (
        <>
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.navigate" components={{ kbd: <Kbd /> }} />
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.order" values={{ alt }} components={{ kbd: <Kbd /> }} />
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.column" values={{ alt }} components={{ kbd: <Kbd /> }} />
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.open" components={{ kbd: <Kbd /> }} />
        </>
      ) : (
        <>
          <span className="text-text-3">·</span>
          <Trans i18nKey="dnd.help.moveColumn" values={{ alt }} components={{ kbd: <Kbd /> }} />
        </>
      )}
    </div>
  );
}
