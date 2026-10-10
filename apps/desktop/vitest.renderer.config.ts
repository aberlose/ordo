import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer') } },
  test: {
    name: 'renderer',
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.tsx'],
    setupFiles: ['src/renderer/test/setup.ts'],
  },
});
