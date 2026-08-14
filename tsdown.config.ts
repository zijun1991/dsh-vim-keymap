/**
 * Browser client bundle for `dsh-client-modules`' loader: a CJS bundle in
 * `platform: 'browser'` wrapped as `window.__ModuleLoader__.load({id,
 * factory})`, the wire format that loader's own source
 * (`packages/client/modules/src/client/manifest.ts`/`system.ts` in
 * deepseek-harness) defines and enforces at runtime — read from the
 * published, open-source repository, not imported from it. Its build preset
 * (`packages/client/tsdown.client.ts`) is internal to that monorepo and not
 * exported for third-party plugins to reuse, so this file reimplements only
 * the observable wire contract: the wrapper shape, and which specifiers the
 * host's frozen module table can actually answer via `require()` at runtime.
 *
 * EXTERNALS mirrors `packages/client/web/src/platform.ts`'s
 * `PLATFORM_MODULES` plus the one documented `dsh-client-runtime/client`
 * exemption (`packages/client/tsdown.client.ts`) — anything not in this list
 * has no entry in the host's module table, so requiring it at runtime throws;
 * this plugin's own dependencies (`@codemirror/*`, `@replit/codemirror-vim`)
 * are not platform modules and must bundle inline instead.
 */
import { defineConfig } from 'tsdown'

const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false, // tsc already populated lib/ with the Node-side build; do not wipe it
  sourcemap: true,
  deps: {
    neverBundle: EXTERNALS,
    alwaysBundle: (id: string) => !EXTERNALS.includes(id),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify('dsh-vim-keymap')}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
