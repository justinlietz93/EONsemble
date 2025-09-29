import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const projectRoot = process.env.PROJECT_ROOT || __dirname

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'jsdom',
    reporters: 'default',
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  }
})
