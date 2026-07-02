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
  }
}
