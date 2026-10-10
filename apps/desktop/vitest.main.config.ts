import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'main', environment: 'node', include: ['src/main/**/*.test.ts'] },
});
