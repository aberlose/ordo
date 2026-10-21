import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_NAME_MAX_LENGTH,
  attachmentBadge,
  attachmentStoredPath,
  fileExtension,
  isExecutableAttachment,
  isImageAttachment,
  normalizeAttachmentName,
} from './attachment';

describe('attachments', () => {
  it('reads extensions', () => {
    expect(fileExtension('maquette-header-v3.PNG')).toBe('png');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('.bashrc')).toBe('');
    expect(fileExtension('README')).toBe('');
    expect(fileExtension('C:\\docs\\cahier.pdf')).toBe('pdf');
  });

  it('builds the tile badge', () => {
    expect(attachmentBadge('cahier-des-charges.pdf')).toBe('PDF');
    expect(attachmentBadge('photo.jpeg')).toBe('JPEG');
    expect(attachmentBadge('data.parquet')).toBe('PARQ');
    expect(attachmentBadge('Makefile')).toBe('FILE');
  });

  it('recognises images by type or extension', () => {
    expect(isImageAttachment('a.bin', 'image/png')).toBe(true);
    expect(isImageAttachment('capture.webp', null)).toBe(true);
    expect(isImageAttachment('notes.pdf', 'application/pdf')).toBe(false);
  });

  it('normalises display names', () => {
    expect(normalizeAttachmentName('/Users/alice/Bureau/maquette.png', 'image.png')).toBe('maquette.png');
    expect(normalizeAttachmentName('  rapport\u0007 final.pdf ', 'x')).toBe('rapport final.pdf');
    expect(normalizeAttachmentName('', 'image-collée.png')).toBe('image-collée.png');
    expect(normalizeAttachmentName('..', 'x')).toBe('x');
    const long = normalizeAttachmentName(`${'a'.repeat(300)}.pdf`, 'x');
    expect(long).toHaveLength(ATTACHMENT_NAME_MAX_LENGTH);
    expect(long.endsWith('.pdf')).toBe(true);
  });

  it('stores files under their id, keeping a safe extension', () => {
    expect(attachmentStoredPath('0192', 'Maquette.PNG')).toBe('0192.png');
    expect(attachmentStoredPath('0192', 'README')).toBe('0192');
    expect(attachmentStoredPath('0192', 'x.p/../h')).toBe('0192');
  });
});

describe('executable attachments', () => {
  it('flags programs, installers, scripts and shortcuts', () => {
    for (const name of [
      'setup.EXE',
      'run.bat',
      'x.command',
      'paquet.pkg',
      'raccourci.lnk',
      'a.js',
      'b.appref-ms',
    ])
      expect(isExecutableAttachment(name)).toBe(true);
    for (const name of ['cahier.pdf', 'photo.png', 'notes.txt', 'Makefile', 'archive.zip'])
      expect(isExecutableAttachment(name)).toBe(false);
  });
});
