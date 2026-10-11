import { isCalendarDay, PRIORITIES } from '@ordo/domain';
import { z } from 'zod';

/** Building blocks shared by every area (boards.ts, tasks.ts, …). */

export const Id = z.string().uuid();
export const CalendarDay = z.string().refine(isCalendarDay, 'Expected a calendar day (YYYY-MM-DD)');
export const Priority = z.literal(PRIORITIES);

export const AppInfo = z.object({
  version: z.string(),
  platform: z.enum(['darwin', 'win32', 'linux']),
  dataPath: z.string(),
});

export const Empty = z.object({}).strict();

export type AppInfo = z.infer<typeof AppInfo>;
