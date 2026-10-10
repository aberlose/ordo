import type { OrdoApi } from '@ordo/contracts';

declare global {
  interface Window {
    readonly api: OrdoApi;
  }
}

export {};
