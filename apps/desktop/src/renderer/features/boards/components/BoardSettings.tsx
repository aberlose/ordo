import type { BoardSummary } from '@ordo/contracts';
import {
  BOARD_NAME_MAX_LENGTH,
  isColumnIconName,
  newBoardDefaults,
  normalizeBoardName,
  type ColumnColor,
  type ColumnIconName,
} from '@ordo/domain';
import { useId, useMemo, useState, type ComponentProps, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/shared/ui/button';
import { COLUMN_ICON_NAMES } from '@renderer/shared/ui/column-icon';
import { Popover, PopoverClose, PopoverTrigger } from '@renderer/shared/ui/popover';
import {
  ColorPicker,
  Hint,
  IconPicker,
  NameField,
  SettingsHeader,
  SettingsPopoverContent,
} from './SettingsPopover';

/** Board-like icons first, in the order of the approved mockup's grid (boards/BoardCreate A). */
const BOARD_ICONS_FIRST: readonly ColumnIconName[] = [
  'kanban',
  'house',
  'lightbulb',
  'package',
  'rocket',
  'briefcase',
  'heart',
  'book-open',
  'plane',
  'code',
  'target',
  'calendar',
  'star',
  'music',
  'graduation-cap',
  'shopping-cart',
];

/** The icon catalogue as boards show it; the catalogue itself is the columns' (`COLUMN_ICON_NAMES`). */
const BOARD_ICON_ORDER: readonly ColumnIconName[] = [
  ...BOARD_ICONS_FIRST,
  ...COLUMN_ICON_NAMES.filter((name) => !BOARD_ICONS_FIRST.includes(name)),
];

export interface BoardStyle {
  name: string;
  icon: ColumnIconName;
  color: ColumnColor;
}

export interface BoardSettingsContentProps extends Omit<
  ComponentProps<typeof SettingsPopoverContent>,
  'titleId' | 'onSubmit' | 'children'
> {
  /** The board to edit ("Icône et couleur…"), or `null` to create one. */
  board: BoardSummary | null;
  /** Colours of the boards in the sidebar: a new board takes the first free one. */
  usedColors: readonly (ColumnColor | null)[];
  /** Normalised name, icon and colour; the caller saves and closes the popover. */
  onSubmit: (style: BoardStyle) => void;
}

/**
 * The column settings popover reused for boards (approved mockup boards/BoardCreate A): 340 px,
 * name prefixed with the icon in its colour, the 10 colours and the searchable icon grid. To be
 * rendered inside a `Popover` (anchored under "+", or under a row's ⋯ to edit).
 */
export function BoardSettingsContent({ board, usedColors, onSubmit, ...content }: BoardSettingsContentProps) {
  const titleId = useId();
  return (
    <SettingsPopoverContent titleId={titleId} {...content}>
      <BoardSettingsForm board={board} usedColors={usedColors} titleId={titleId} onSubmit={onSubmit} />
    </SettingsPopoverContent>
  );
}

export interface BoardSettingsProps extends Omit<BoardSettingsContentProps, 'board'> {
  /** The button the popover hangs from ("+" of the sidebar or the rail); highlighted while open. */
  trigger: ReactElement;
  /** Opened on first render (stories, tests). */
  defaultOpen?: boolean;
}

/** "Nouveau board" under the sidebar's "+": closes once submitted (the caller opens the new board). */
export function BoardSettings({ trigger, defaultOpen = false, onSubmit, ...content }: BoardSettingsProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <BoardSettingsContent
        board={null}
        onSubmit={(style) => {
          onSubmit(style);
          setOpen(false);
        }}
        {...content}
      />
    </Popover>
  );
}

/** Mounted each time the popover opens, so it starts from the saved board (or the defaults). */
function BoardSettingsForm({
  board,
  usedColors,
  titleId,
  onSubmit,
}: {
  board: BoardSummary | null;
  usedColors: readonly (ColumnColor | null)[];
  titleId: string;
  onSubmit: (style: BoardStyle) => void;
}) {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const defaults = newBoardDefaults(usedColors);
    if (!board) return defaults;
    return {
      icon: isColumnIconName(board.icon) ? board.icon : defaults.icon,
      color: board.color ?? defaults.color,
    };
  }, [board, usedColors]);
  const [name, setName] = useState(board?.name ?? '');
  const [color, setColor] = useState<ColumnColor>(initial.color);
  const [icon, setIcon] = useState<ColumnIconName>(initial.icon);
  const [query, setQuery] = useState('');
  const normalized = normalizeBoardName(name);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (normalized) onSubmit({ name: normalized, icon, color });
  };

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <SettingsHeader titleId={titleId} title={t(board ? 'boardSettings.title' : 'boardSettings.newTitle')} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3.5">
        <NameField
          label={t('boardSettings.name')}
          icon={icon}
          color={color}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('boardSettings.namePlaceholder')}
          maxLength={BOARD_NAME_MAX_LENGTH}
        />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker
          icon={icon}
          color={color}
          query={query}
          onQuery={setQuery}
          onPick={setIcon}
          order={BOARD_ICON_ORDER}
          searchPlaceholder={t('boardSettings.iconSearchPlaceholder')}
        />
        {!board && (
          <Hint className="mt-0">
            {t('boardSettings.hint', {
              todo: t('column.todo'),
              inProgress: t('column.inProgress'),
              done: t('column.done'),
            })}
          </Hint>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <PopoverClose asChild>
          <Button>{t('boardSettings.cancel')}</Button>
        </PopoverClose>
        <Button type="submit" variant="primary" disabled={!normalized} className="px-3.5">
          {t(board ? 'boardSettings.save' : 'boardSettings.create')}
        </Button>
      </div>
    </form>
  );
}
