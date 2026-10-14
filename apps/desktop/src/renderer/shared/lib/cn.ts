import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** The type scale of index.css (`--text-*`): sizes, so `text-meta text-text-2` keeps both. */
const FONT_SIZES = [
  'kbd',
  'caption',
  'label',
  'small',
  'meta',
  'body',
  'title',
  'heading',
  'heading-lg',
  'display',
];

const merge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: FONT_SIZES }] } } });

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
