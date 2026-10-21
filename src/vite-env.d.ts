/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base URL, e.g. https://api.example.com/api/v1. Unset → same-origin /api/v1. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
