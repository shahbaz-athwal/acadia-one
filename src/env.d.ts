/// <reference types="vite/client" />

// interface ImportMetaEnv {
//   // Client-side environment variables
// }

// interface ImportMeta {
//   readonly env: ImportMetaEnv;
// }

declare namespace NodeJS {
  interface ProcessEnv {
    readonly ACADIA_ADMIN_USERNAME: string;
    readonly ACADIA_ADMIN_PASSWORD: string;
    /** Shared secret that gates `/admin`. Unset disables the dashboard. */
    readonly ADMIN_PASSWORD?: string;
    /** SQLite connection string, e.g. `file:./local.db`. */
    readonly DATABASE_URL?: string;
  }
}
