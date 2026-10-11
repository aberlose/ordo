import { CircleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedback } from '../feedback/store';
import { useKeyboardTarget } from '../keyboard/focus';
import { cn } from '../lib/cn';

const VISIBLE_MS = 6000;

export interface FeedbackProps {
  /**
   * `app` (once, in the layout) or `modal` (inside a modal window, which makes the rest of the app
   * inert): the toast and announcements render in the innermost one.
   */
  scope?: 'app' | 'modal';
  /** Keep the toast until closed (stories). */
  persistent?: boolean;
}

/**
 * The error toast and the polite live region. Approved mockup: drag-and-drop/Toast A —
 * compact bar, bottom centre, inverse colours; hides after 6 s, paused while hovered or focused.
 */
export function Feedback({ scope = 'app', persistent = false }: FeedbackProps) {
  const { t } = useTranslation();
  const toast = useFeedback((state) => state.toast);
  const announcement = useFeedback((state) => state.announcement);
  const dismiss = useFeedback((state) => state.dismissToast);
  const covered = useFeedback((state) => scope === 'app' && state.modals > 0);
  const [paused, setPaused] = useState(false);
  // Above the keyboard help bar when both are shown.
  const raised = useKeyboardTarget((state) => state.target !== null);

  useEffect(() => {
    if (scope !== 'modal') return;
    useFeedback.getState().enterModal();
    return () => useFeedback.getState().leaveModal();
  }, [scope]);

  useEffect(() => {
    if (!toast || paused || persistent) return;
    const timer = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, paused, persistent, dismiss]);

  if (covered) return null;
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div
        className={cn(
          'pointer-events-none fixed inset-x-6 z-50 flex justify-center',
          raised ? 'bottom-18' : 'bottom-6',
        )}
      >
        {toast && (
          <div
            key={toast.id}
            role="alert"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-card bg-inverse py-2 pr-2 pl-3.5 text-meta text-inverse-fg shadow-pop"
          >
            <CircleAlert size={16} strokeWidth={2.2} className="shrink-0 text-inverse-danger" aria-hidden />
            <span className="text-pretty">{toast.message}</span>
            {toast.retry && (
              <button
                type="button"
                onClick={() => {
                  dismiss();
                  toast.retry?.();
                }}
                className="h-6.5 shrink-0 rounded-md px-2 font-semibold text-inverse-accent hover:bg-inverse-fg/10"
              >
                {t('feedback.retry')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('feedback.close')}
              onClick={dismiss}
              className="flex size-6.5 shrink-0 items-center justify-center rounded-md text-inverse-fg/70 hover:bg-inverse-fg/10"
            >
              <X size={14} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
