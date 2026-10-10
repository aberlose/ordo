import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

/** Workspace packages are TypeScript sources: bundle them instead of requiring them at runtime. */
const workspace = ['@ordo/domain', '@ordo/contracts'];

/** Vite's HMR websocket is allowed by the CSP in development only. */
const devCsp = (): Plugin => ({
  name: 'ordo-dev-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace("connect-src 'self'", "connect-src 'self' ws://localhost:*"),
});

export default defineConfig({
  main: {
    build: { externalizeDeps: { exclude: workspace } },
  },
  preload: {
    // A sandboxed preload must be a single CommonJS file with everything bundled in.
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer') } },
    plugins: [react(), tailwindcss(), devCsp()],
    build: { minify: true },
  },
});
