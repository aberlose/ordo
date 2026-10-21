import { COLUMN_COLORS, fileExtension, isImageAttachment, type ColumnColor } from '@ordo/domain';
import type { TFunction } from 'i18next';
import { dateToDay, formatDay } from '@renderer/shared/lib/dates';

/**
 * Badge colour of a file type, from the column palette: the approved mockups give PDF red, FIG blue,
 * MOV teal and images violet; common families follow, any other extension gets a stable colour.
 */
const FAMILIES: Readonly<Record<string, ColumnColor>> = {
  pdf: 'red',
  fig: 'blue',
  sketch: 'blue',
  psd: 'blue',
  ai: 'blue',
  xd: 'blue',
  doc: 'blue',
  docx: 'blue',
  odt: 'blue',
  pages: 'blue',
  rtf: 'blue',
  txt: 'slate',
  md: 'slate',
  xls: 'green',
  xlsx: 'green',
  csv: 'green',
  ods: 'green',
  numbers: 'green',
  ppt: 'orange',
  pptx: 'orange',
  key: 'orange',
  odp: 'orange',
  zip: 'amber',
  rar: 'amber',
  '7z': 'amber',
  tar: 'amber',
  gz: 'amber',
  mov: 'teal',
  mp4: 'teal',
  avi: 'teal',
  mkv: 'teal',
  webm: 'teal',
  mp3: 'pink',
  wav: 'pink',
  m4a: 'pink',
  flac: 'pink',
  json: 'cyan',
  js: 'cyan',
  ts: 'cyan',
  html: 'cyan',
  css: 'cyan',
  xml: 'cyan',
};

export function badgeColor(fileName: string, mimeType: string | null = null): ColumnColor {
  const ext = fileExtension(fileName);
  if (ext === '') return 'slate';
  const family = FAMILIES[ext];
  if (family) return family;
  if (isImageAttachment(fileName, mimeType)) return 'violet';
  let hash = 0;
  for (const char of ext) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLUMN_COLORS[hash % COLUMN_COLORS.length]!;
}

/** "412 Ko", "2,4 Mo" / "412 KB", "2.4 MB": bytes and kilobytes rounded, one decimal above. */
export function formatSize(bytes: number, t: TFunction, language: string | undefined): string {
  const units = ['b', 'kb', 'mb', 'gb'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(language ?? 'fr', {
    maximumFractionDigits: unit >= 2 ? 1 : 0,
  }).format(unit === 1 ? Math.max(1, Math.round(value)) : value);
  return t(`attachments.size.${units[unit]!}`, { value: number });
}

/** The tile's second line: "412 Ko · 30 sept.". */
export function attachmentMeta(
  attachment: { sizeBytes: number; createdAt: number },
  t: TFunction,
  language: string | undefined,
): string {
  return t('attachments.meta', {
    size: formatSize(attachment.sizeBytes, t, language),
    date: formatDay(dateToDay(new Date(attachment.createdAt)), language),
  });
}

export type RevealPlatform = 'mac' | 'windows' | 'other';

/** "Afficher dans le Finder" on macOS, "… l'Explorateur" on Windows, "… le dossier" elsewhere. */
export function revealPlatform(): RevealPlatform {
  if (typeof navigator === 'undefined') return 'other';
  if (/Mac/i.test(navigator.userAgent)) return 'mac';
  if (/Windows/i.test(navigator.userAgent)) return 'windows';
  return 'other';
}
