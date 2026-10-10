/**
 * Layer rules — see docs/architecture.md ("Dependency rules").
 * CI fails on any violation.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      comment: 'packages/domain imports nothing but itself.',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { pathNot: '^packages/domain/' },
    },
    {
      name: 'contracts-only-domain-and-zod',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { pathNot: ['^packages/(contracts|domain)/', 'node_modules/zod'] },
    },
    {
      name: 'renderer-not-main-or-preload',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/' },
      to: {
        path: ['^apps/desktop/src/(main|preload)/', 'node_modules/(electron|better-sqlite3|drizzle-orm)/'],
      },
    },
    {
      name: 'renderer-no-node-builtins',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'feature-public-api-only',
      comment: 'A feature imports another feature only through its index.ts.',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/features/([^/]+)/' },
      to: {
        path: '^apps/desktop/src/renderer/features/([^/]+)/.+',
        pathNot: [
          '^apps/desktop/src/renderer/features/$1/',
          '^apps/desktop/src/renderer/features/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'main-not-renderer',
      severity: 'error',
      from: { path: '^apps/desktop/src/(main|preload)/' },
      to: { path: '^apps/desktop/src/renderer/' },
    },
    {
      name: 'application-is-framework-free',
      comment: 'Use cases depend on ports, not on Electron, the database or the IPC layer.',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/application/' },
      to: {
        path: [
          '^apps/desktop/src/main/(ipc|infrastructure|app)/',
          'node_modules/(electron|better-sqlite3|drizzle-orm)/',
        ],
      },
    },
    {
      name: 'ipc-not-infrastructure',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/ipc/' },
      to: { path: '^apps/desktop/src/main/infrastructure/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '\\.stories\\.tsx$', 'out/', 'dist/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/desktop/tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
