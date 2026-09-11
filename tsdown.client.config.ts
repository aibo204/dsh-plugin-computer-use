import { defineConfig } from 'tsdown'

const sharedModules = new Set([
  'react', 'react/jsx-runtime', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-settings-plugins',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-trajectory',
])

/** Bundle the browser companion after its generated Remote client exists. */
export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: specifier => sharedModules.has(specifier),
    alwaysBundle: specifier => !sharedModules.has(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "@aibo204/dsh-plugin-computer-use", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
