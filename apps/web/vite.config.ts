import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API is served through this origin, so the httpOnly session
    // cookie is first-party and no CORS is involved. Override the target if the API
    // runs elsewhere.
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Runs before workers start so they inherit a fixed time zone (see file).
    globalSetup: ['./vitest.global-setup.ts'],
    env: { VITE_API_URL: 'http://api.test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
