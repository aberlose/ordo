import { Trans, useTranslation } from 'react-i18next';
import { useKeyboardTarget } from '../keyboard/focus';
import { altKey } from '../lib/platform';
import { Kbd } from './kbd';

/**
 * Help bar centred at the bottom of the board while a card or a column header has keyboard focus
 * (approved mockup: drag-and-drop/KeyboardMove B). Decorative for screen readers: cards and headers
 * carry the same hint in their description.
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
      <span className="font-semibold text-text">
        {t(target === 'card' ? 'dnd.help.cardSelected' : 'dnd.help.columnSelected')}
      </span>
      {target === 'card' ? (
        <>
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
