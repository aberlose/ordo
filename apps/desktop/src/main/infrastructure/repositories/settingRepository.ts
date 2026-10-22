import { eq } from 'drizzle-orm';
import type { SettingRepository } from '../../application/ports';
import type { Db } from '../db/client';
import { setting } from '../db/schema';

export function settingRepository(db: Db): SettingRepository {
  return {
    get: (key) =>
      db.select({ value: setting.value }).from(setting).where(eq(setting.key, key)).get()?.value ?? null,
    set: (key, value) => {
      db.insert(setting)
        .values({ key, value })
        .onConflictDoUpdate({ target: setting.key, set: { value } })
        .run();
    },
  };
}
