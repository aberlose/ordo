import { randomBytes } from 'node:crypto';
import type { Clock, IdGenerator } from '../application/ports';

/** UUIDv7 (RFC 9562): 48-bit Unix ms timestamp, then random bits. Time-sortable. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  const ms = BigInt(now);
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const systemClock: Clock = { now: () => Date.now() };

export function uuidv7Generator(clock: Clock = systemClock): IdGenerator {
  return { next: () => uuidv7(clock.now()) };
}
