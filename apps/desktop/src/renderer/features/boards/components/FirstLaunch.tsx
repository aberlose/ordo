import { Plus } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { modKey } from '@renderer/shared/lib/platform';
import { Kbd } from '@renderer/shared/ui/kbd';

export interface FirstLaunchProps {
  onCreateEmpty: () => void;
  creating?: boolean;
}

/** Approved mockup: docs/design/mockups/empty-states (first launch). */
export function FirstLaunch({ onCreateEmpty, creating = false }: FirstLaunchProps) {
  const { t } = useTranslation();
  return (
    <main className="flex flex-1 items-center justify-center p-10">
      <div className="flex w-150 max-w-full flex-col items-center gap-3.5 text-center">
        <div
          aria-hidden
          className="mb-1.5 flex size-16 items-center justify-center rounded-logo text-3xl font-bold text-accent-fg [background:var(--accent-bg)]"
        >
          O
        </div>
        <h1 className="m-0 text-display font-bold tracking-tight">{t('welcome.title')}</h1>
        <p className="m-0 max-w-115 text-title leading-relaxed text-text-2">{t('welcome.subtitle')}</p>
        {/* The "discover with an example" card is hidden until the example board exists (MVP). */}
        <div className="mt-4 flex w-full justify-center">
          <button
            type="button"
            onClick={onCreateEmpty}
            disabled={creating}
            aria-busy={creating}
            className="flex w-1/2 flex-col items-start gap-2 rounded-xl border-2 border-accent bg-surface p-4.5 text-left shadow-card disabled:opacity-60"
          >
            <span className="flex size-9 items-center justify-center rounded-tile bg-accent-soft text-accent">
              <Plus size={18} aria-hidden />
            </span>
            <span className="text-title font-semibold">{t('welcome.emptyTitle')}</span>
            <span className="text-meta leading-snug text-text-3">{t('welcome.emptyBody')}</span>
          </button>
        </div>
        <p className="mt-4 text-meta text-text-3">
          <Trans i18nKey="welcome.tip" values={{ mod: modKey() }} components={{ kbd: <Kbd /> }} />
        </p>
      </div>
    </main>
  );
}
