import { defineConfig } from 'tsdown'
import { decoratorLowering } from './scripts/decorator-lowering.ts'

/** Build the Host entries before generating their Typert Remote artifacts. */
export default defineConfig({
  entry: ['src/index.ts', 'src/archive.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  plugins: [decoratorLowering()],
  deps: { neverBundle: [/^@deepseek-ai\//, /^open-computer-use(?:\/|$)/] },
})
