import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  oxc: {
    // Transform TSX files so react-pdf JSX works in Vitest (tsconfig sets
    // jsx: preserve for Next.js, which Vite/OXC can't handle directly).
    jsx: { runtime: 'automatic' },
  },
})
