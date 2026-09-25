interface ImportMetaEnv {
  /** API origin, e.g. https://api.example.com. Empty: same origin (dev proxy). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
