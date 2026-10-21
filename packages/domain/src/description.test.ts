import { describe, expect, it } from 'vitest';
import {
  attachmentIdsInDescription,
  clampImageWidth,
  descriptionText,
  isEmptyDescription,
  remapDescriptionAttachments,
  type DocNode,
} from './description';

const text = (value: string): DocNode => ({ type: 'text', text: value });
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const image = (attachmentId: string): DocNode => ({ type: 'image', attrs: { attachmentId, width: 60 } });

const doc: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('Points d’attention')] },
    p(text('Le header reste '), { type: 'text', text: 'sticky', marks: [{ type: 'bold' }] }, text('.')),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('64 px'))] },
        { type: 'listItem', content: [p(text('56 px'))] },
      ],
    },
    image('a1'),
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [p(text('Écran'))] },
            { type: 'tableHeader', content: [p(text('Hauteur'))] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [p(text('Mobile'))] },
            { type: 'tableCell', content: [p(text('56 px'))] },
          ],
        },
      ],
    },
    p(text('Ligne'), { type: 'hardBreak' }, text('suivante')),
    image('a2'),
    image('a1'),
  ],
};

describe('description text', () => {
  it('keeps the text of every block, one per line, cells tab-separated', () => {
    expect(descriptionText(doc)).toBe(
      'Points d’attention\nLe header reste sticky.\n64 px\n56 px\nÉcran\tHauteur\nMobile\t56 px\nLigne\nsuivante',
    );
  });

  it('is empty without notes', () => {
    expect(descriptionText(null)).toBe('');
    expect(descriptionText({ type: 'doc', content: [p()] })).toBe('');
  });

  it('counts an image as content', () => {
    expect(isEmptyDescription(null)).toBe(true);
    expect(isEmptyDescription({ type: 'doc', content: [p()] })).toBe(true);
    expect(isEmptyDescription({ type: 'doc', content: [image('a1')] })).toBe(false);
    expect(isEmptyDescription(doc)).toBe(false);
  });
});

describe('images of the notes', () => {
  it('lists the attachments referenced, once each', () => {
    expect(attachmentIdsInDescription(doc)).toEqual(['a1', 'a2']);
    expect(attachmentIdsInDescription(null)).toEqual([]);
  });

  it('remaps attachment ids and keeps unknown ones', () => {
    const copy = remapDescriptionAttachments(doc, new Map([['a1', 'b1']]));
    expect(attachmentIdsInDescription(copy)).toEqual(['b1', 'a2']);
    expect(descriptionText(copy)).toBe(descriptionText(doc));
    expect(attachmentIdsInDescription(doc)).toEqual(['a1', 'a2']);
  });

  it('clamps the image width', () => {
    expect(clampImageWidth(5)).toBe(20);
    expect(clampImageWidth(64.6)).toBe(65);
    expect(clampImageWidth(140)).toBe(100);
    expect(clampImageWidth(Number.NaN)).toBe(100);
  });
});
