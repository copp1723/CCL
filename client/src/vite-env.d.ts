/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CCL_API_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}