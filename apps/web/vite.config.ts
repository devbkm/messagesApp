import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Runs before workers start so they inherit a fixed time zone (see file).
    globalSetup: ['./vitest.global-setup.ts'],
    env: { VITE_API_URL: 'http://api.test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
