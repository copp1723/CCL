/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CCL_API_KEY: string;
  // Add more env variables here as needed
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
