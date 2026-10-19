import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@renderer/shared/lib/cn';
import type { TagLook } from '../../hooks/tags';
import { TagChip } from './TagChip';

/*
 * Widths (px) of the card's tag line, to fit the tags on one line without measuring the DOM: the 10,000-task
 * board renders many cards, so each card only adds up cached text widths.
 */
/** The column width token (index.css), read once from :root. */
const COLUMN_WIDTH_VAR = '--column-width';
/** Where the stylesheet is not loaded (tests): the column width of the approved mockups. */
const FALLBACK_COLUMN_WIDTH = 296;
/** Around the card content: padding (2 × 14, `px-3.5`) + border (2 × 1). */
const CARD_CHROME = 30;
/** Gap between tags (`gap-1.25`). */
const GAP = 5;
/** Chip around its text: left padding 6 + bar 3 + gap 5 + right padding 8. */
const CHIP_CHROME = 22;
/** "+N" around its text: padding 2 × 7. */
const MORE_CHROME = 14;
/** The type scale's `text-small` (12 px), weight 500, in the app font. */
const FONT = `500 12px 'Figtree Variable', system-ui, sans-serif`;
/** Average glyph width of that font where the canvas cannot measure (tests). */
const FALLBACK_CHAR = 6.4;

const widths = new Map<string, number>();
let context: OffscreenCanvasRenderingContext2D | null | undefined;
let lineWidth: number | undefined;

/** Card content width: the column width token minus the card's padding and border. */
function cardLineWidth(): number {
  if (lineWidth === undefined) {
    const column = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(COLUMN_WIDTH_VAR));
    lineWidth = (Number.isFinite(column) ? column : FALLBACK_COLUMN_WIDTH) - CARD_CHROME;
  }
  return lineWidth;
}

/*
 * Widths measured before the app font is loaded are those of the fallback font: once fonts finish
 * loading, the cache is cleared and the mounted tag lines render once more.
 */
let fontsVersion = 0;
const listeners = new Set<() => void>();
function fontsLoaded() {
  widths.clear();
  fontsVersion += 1;
  for (const listener of listeners) listener();
}
if (typeof document !== 'undefined' && 'fonts' in document) {
  void document.fonts.ready.then(fontsLoaded);
  document.fonts.addEventListener('loadingdone', fontsLoaded);
}
const subscribeFonts = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getFontsVersion = () => fontsVersion;

/** Width of a tag's text, cached by name. */
export function textWidth(text: string): number {
  const cached = widths.get(text);
  if (cached !== undefined) return cached;
  if (context === undefined) {
    context = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    if (context) context.font = FONT;
  }
  const width = context ? context.measureText(text).width : text.length * FALLBACK_CHAR;
  widths.set(text, width);
  return width;
}

/**
 * How many tags fit on the line, the rest summed up as "+N" (at least one tag shows, shortened if
 * needed). Pure: `tagWidths` are the chips' full widths.
 */
export function fitTags(
  tagWidths: readonly number[],
  lineWidth: number,
  moreWidth: (hidden: number) => number,
) {
  const total = tagWidths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, tagWidths.length - 1);
  if (total <= lineWidth) return tagWidths.length;
  let used = 0;
  let shown = 0;
  for (const [index, width] of tagWidths.entries()) {
    const next = used + (index > 0 ? GAP : 0) + width;
    if (next + GAP + moreWidth(tagWidths.length - index - 1) > lineWidth) break;
    used = next;
    shown += 1;
  }
  return Math.max(1, shown);
}

const chipWidth = (name: string) => CHIP_CHROME + textWidth(name);
const moreWidth = (hidden: number) => MORE_CHROME + textWidth(`+${hidden}`);

/**
 * The tags of a card on one line; the overflow is summed up as "+N", whose hover (or the card's
 * keyboard focus) shows the hidden tags in a bubble. Approved mockup tags-subtasks/CardTags A.
 * Screen readers get one text listing every tag; the chips are hidden from them.
 */
export function CardTags({ tags, bubbleOpen = false }: { tags: readonly TagLook[]; bubbleOpen?: boolean }) {
  const { t } = useTranslation();
  useSyncExternalStore(subscribeFonts, getFontsVersion);
  const shown = fitTags(
    tags.map((tag) => chipWidth(tag.name)),
    cardLineWidth(),
    moreWidth,
  );
  const hidden = tags.slice(shown);
  return (
    <span className="relative flex min-w-0">
      <span className="sr-only">
        {t('tags.card.list', { names: tags.map((tag) => tag.name).join(', ') })}
      </span>
      <span aria-hidden className="flex min-w-0 items-center gap-1.25">
        {tags.slice(0, shown).map((tag) => (
          <TagChip key={tag.id} name={tag.name} color={tag.color} truncate />
        ))}
        {hidden.length > 0 && (
          <>
            <span className="peer/more inline-flex h-5.5 shrink-0 items-center rounded bg-accent-soft px-1.75 text-small font-medium text-text-2 tabular-nums">
              +{hidden.length}
            </span>
            {/* Shown on hover of "+N" or keyboard focus of the card. */}
            <span
              className={cn(
                'absolute top-full right-0 z-10 mt-1.5 hidden w-max max-w-44 flex-wrap gap-1.25 rounded-lg border border-border bg-surface p-2 shadow-pop peer-hover/more:flex group-focus-visible/card:flex',
                bubbleOpen && 'flex',
              )}
            >
              {hidden.map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
