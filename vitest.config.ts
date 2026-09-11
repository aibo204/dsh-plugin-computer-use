import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { decoratorLowering } from './scripts/decorator-lowering.ts'

/** Keep plugin unit tests independent from Vite configurations in parent directories. */
export default defineConfig({
  plugins: [decoratorLowering()],
  resolve: {
    alias: {
      '@aibo204/dsh-plugin-computer-use/remote': fileURLToPath(new URL('./lib/typert.remote-client.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
