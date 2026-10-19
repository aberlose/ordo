import {
  Code2,
  Heading2,
  Image as ImageIcon,
  List,
  ListChecks,
  Table,
  TextQuote,
  type LucideIcon,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import type { BlockId } from './helpers';
import type { SlashStore } from './slash';

const ICONS: Record<BlockId, LucideIcon> = {
  heading: Heading2,
  taskList: ListChecks,
  bulletList: List,
  codeBlock: Code2,
  blockquote: TextQuote,
  table: Table,
  image: ImageIcon,
};

export const SLASH_MENU_ID = 'notes-slash-menu';

/**
 * The "/" block menu (approved mockup: task-detail/FullScreen): under the caret, "Blocs" then the
 * blocks with their Markdown shortcut. The focus stays in the editor (↑ ↓ Enter, Escape): the list
 * is an ARIA listbox whose active option is announced through `aria-activedescendant` on the editor.
 */
export function SlashMenu({ store }: { store: SlashStore }) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!state.open || !state.position) return null;
  return (
    <div
      id={SLASH_MENU_ID}
      role="listbox"
      aria-label={t('notes.blocks.label')}
      style={state.position}
      // Keep the editor focused: a click must not blur it before the block is inserted.
      onMouseDown={(event) => event.preventDefault()}
      className="absolute z-20 flex w-menu-blocks flex-col rounded-card border border-border bg-surface p-1.5 text-text shadow-pop"
    >
      <div aria-hidden className="px-2 pt-1 pb-1.5 text-caption font-medium text-text-3">
        {t('notes.blocks.title')}
      </div>
      {state.items.length === 0 && (
        <div className="px-2 pb-1.5 text-body text-text-3">{t('notes.blocks.empty')}</div>
      )}
      {state.items.map((block, index) => {
        const Icon = ICONS[block.id];
        return (
          <div
            key={block.id}
            id={`${SLASH_MENU_ID}-${block.id}`}
            role="option"
            aria-selected={index === state.index}
            onPointerMove={() => index !== state.index && store.highlight(index)}
            onClick={() => store.choose(index)}
            className={cn(
              'flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-body',
              index === state.index && 'bg-rail',
            )}
          >
            <span className="flex h-5.5 w-6.5 items-center justify-center rounded-md border border-border text-text-2">
              <Icon size={13} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="flex-1">{t(`notes.blocks.${block.id}`)}</span>
            {block.markdown && (
              <span aria-hidden className="font-mono text-kbd text-text-3">
                {block.markdown}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
