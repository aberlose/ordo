import type { Attachment } from '@ordo/contracts';
import { attachmentBadge, isImageAttachment } from '@ordo/domain';
import { ExternalLink, Folder, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import { Button } from '@renderer/shared/ui/button';
import { columnColorVar, columnTextColorVar } from '@renderer/shared/ui/colors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/shared/ui/dropdown-menu';
import { Popover, PopoverAnchor, PopoverContent } from '@renderer/shared/ui/popover';
import { attachmentMeta, badgeColor, type RevealPlatform } from './format';

/** Shared by the file, copying and failed tiles (approved mockup: 236 × 54, 10 px radius). */
export const tileClass =
  'relative flex h-13.5 w-59 items-center gap-2.5 rounded-card border border-border bg-surface px-2.5';
export const badgeClass =
  'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-kbd font-bold';

/** The type badge: the extension in a palette colour, or the image's thumbnail (none without a `url`). */
export function TileBadge({ fileName, mimeType, url }: Pick<Attachment, 'fileName' | 'mimeType' | 'url'>) {
  const [broken, setBroken] = useState(false);
  if (url !== '' && isImageAttachment(fileName, mimeType) && !broken) {
    return (
      <span className={cn(badgeClass, 'bg-rail')}>
        <img
          src={url}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }
  const color = badgeColor(fileName, mimeType);
  const style: CSSProperties = {
    background: `color-mix(in srgb, ${columnColorVar(color)} 14%, var(--surface))`,
    color: columnTextColorVar(color),
  };
  return (
    <span className={badgeClass} style={style} aria-hidden>
      {attachmentBadge(fileName)}
    </span>
  );
}

export interface AttachmentTileProps {
  attachment: Attachment;
  reveal: RevealPlatform;
  onOpen: (attachment: Attachment) => void;
  onReveal: (attachment: Attachment) => void;
  /** Confirmed in the bubble: deleted for good. */
  onDelete: (attachment: Attachment) => void;
  /** Stories: the ⋯ menu shown open. */
  defaultMenuOpen?: boolean;
  /** Stories: the confirmation bubble shown open. */
  defaultConfirming?: boolean;
}

/**
 * Approved mockup: notes-attachments/Attachments A. Double-click or Enter opens the file with its
 * default application; on hover or focus a ⋯ opens Ouvrir, Afficher dans le Finder / l'Explorateur and
 * Supprimer…, which asks first in a bubble anchored on the tile (Annuler focused).
 */
export const AttachmentTile = memo(function AttachmentTile({
  attachment,
  reveal,
  onOpen,
  onReveal,
  onDelete,
  defaultMenuOpen = false,
  defaultConfirming = false,
}: AttachmentTileProps) {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(defaultMenuOpen);
  const [confirming, setConfirming] = useState(false);
  // Stories: opened once the window has taken the focus, which would otherwise dismiss the bubble.
  useEffect(() => {
    if (!defaultConfirming) return;
    const timer = setTimeout(() => setConfirming(true), 50);
    return () => clearTimeout(timer);
  }, [defaultConfirming]);
  const tile = useRef<HTMLButtonElement>(null);
  /** Supprimer… was chosen: the menu must not take the focus back from the bubble. */
  const toConfirm = useRef(false);
  /** The file was deleted: the list moves the focus on, the bubble must not give it back to the tile. */
  const deleted = useRef(false);
  const ids = useId();
  const name = attachment.fileName;
  const meta = attachmentMeta(attachment, t, i18n.resolvedLanguage);

  const open = () => onOpen(attachment);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      open();
    }
  };
  // A pointer click only selects (focus); keyboard and assistive technologies click with detail 0.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) open();
  };

  return (
    <Popover open={confirming} onOpenChange={setConfirming}>
      <li className="group/tile relative list-none">
        <PopoverAnchor asChild>
          <button
            ref={tile}
            type="button"
            data-attachment-id={attachment.id}
            aria-keyshortcuts="Enter"
            onKeyDown={onKeyDown}
            onClick={onClick}
            onDoubleClick={open}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenuOpen(true);
            }}
            className={cn(
              tileClass,
              'cursor-default pr-10 text-left hover:bg-rail',
              (menuOpen || confirming) && 'bg-rail',
            )}
          >
            <TileBadge fileName={name} mimeType={attachment.mimeType} url={attachment.url} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-meta font-medium text-text">{name}</span>
              <span className="truncate text-caption text-text-3">{meta}</span>
            </span>
          </button>
        </PopoverAnchor>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label={t('attachments.actions', { name })}
            className={cn(
              'absolute top-1/2 right-2.5 flex size-6.5 -translate-y-1/2 items-center justify-center rounded-md text-text-2 opacity-0 hover:bg-accent-soft focus-visible:opacity-100',
              'group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 data-[state=open]:bg-accent-soft data-[state=open]:opacity-100',
            )}
          >
            <MoreHorizontal size={14} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            aria-label={t('attachments.actions', { name })}
            className="w-menu-file"
            onCloseAutoFocus={(event) => {
              if (!toConfirm.current) return;
              toConfirm.current = false;
              event.preventDefault();
            }}
          >
            <DropdownMenuItem onSelect={open}>
              <ExternalLink size={15} className="text-text-2" aria-hidden />
              {t('attachments.open')}
              <span className="ml-auto font-mono text-kbd text-text-3" aria-hidden>
                {t('attachments.openKey')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onReveal(attachment)}>
              <Folder size={15} className="text-text-2" aria-hidden />
              {t(`attachments.reveal.${reveal}`)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger"
              onSelect={() => {
                toConfirm.current = true;
                setConfirming(true);
              }}
            >
              <Trash2 size={15} aria-hidden />
              {t('attachments.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
      <PopoverContent
        role="alertdialog"
        side="bottom"
        align="start"
        aria-label={t('attachments.deleteTitle')}
        aria-describedby={`${ids}-confirm`}
        className="flex w-popover-xs flex-col gap-2.5 rounded-popover p-3.5"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (deleted.current) return;
          tile.current?.focus({ focusVisible: true } as FocusOptions);
        }}
      >
        <span className="text-body font-semibold break-words">
          {t('attachments.deleteConfirm', { name })}
        </span>
        <span id={`${ids}-confirm`} className="text-label leading-snug text-text-3">
          {t('attachments.deleteHint')}
          {isImageAttachment(name, attachment.mimeType) && ` ${t('attachments.deleteImageHint')}`}
        </span>
        <div className="flex justify-end gap-2">
          {/* First in the bubble: the safe choice takes the focus. */}
          <Button onClick={() => setConfirming(false)}>{t('attachments.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              deleted.current = true;
              setConfirming(false);
              onDelete(attachment);
            }}
          >
            {t('attachments.confirm')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
