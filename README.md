# dsh-vim-keymap

Vim keybindings for the [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI, shipped as an independent, out-of-tree Cordis plugin — it never modifies deepseek-harness itself.

## Modes

```
Insert (default, composer textarea)
  Esc            -> Normal
  Shift+Esc      -> Session
  Enter          -> newline (untouched)
  Cmd/Alt+Enter  -> send (untouched)

Normal (real vim text editing, inside the composer textarea)
  :              -> Command (normal flavor)
  i/a/o/...      -> Insert

Session (workspace/session tree navigation, not text)
  j/k            -> move highlight
  Enter          -> on a workspace row: fold/unfold; on a session/search-result
                    row: open it and return straight to Insert (composer refocused)
  /              -> focus the host's session search (not yet wired, see below)
  :              -> Command (session flavor)
  Esc            -> straight to Insert (composer refocused)

Command (one global floating input, two visually distinct flavors)
```

A small mode badge (bottom-right, non-interactive, reads `Vim Mode: <MODE>`)
shows which of the four modes is live — the only visual cue for it, since
nothing in the host UI otherwise indicates vim state. Its display policy —
`'persistent'` (always shown, the default), `'on-change'` (shown for ~1.2s
after a transition, then hidden), or `'hidden'` — is user-editable through a
"Vim Keymap" card this plugin registers into Settings → Plugins → Plugin
configuration, backed by `localStorage` (see "Settings persistence" below for
why not the Host settings document).

## Why this never touches deepseek-harness

Every integration point is either an existing, general-purpose extension point, or driven off already-public, already-rendered state:

- **Normal mode** reaches the composer's `useInput`/`inputActions` by registering a headless (render-nothing) component into `conversation.session.header.actions` — a `list`-kind slot `ui-conversation` already declares for third-party header buttons. It never registers into `conversation.composer.bar` (InputBar's own exclusive slot) and never imports InputBar internals. Real text editing runs on a headless `@codemirror/view` `EditorView` with `@replit/codemirror-vim`, never mounted to visible DOM; edits flow back through `inputActions.setDraft()`, the same public write path InputBar itself uses.
- **Session mode** never imports `ui-workspace` or its view store. It reads the workspace tree straight off the rendered, accessible DOM (`role="tree"`/`role="treeitem"`/`aria-expanded`) and drives fold/expand and row-open by dispatching real `click` events on the row elements — the same thing a mouse user does. `ui-workspace`'s internal store is never touched.
- **Command mode** portals into `document.body`, and the whole plugin's global surface (the Session-mode overlay + Command palette + mode badge) registers into `shell.overlay`, the additive global-overlay slot `ui-layout` documents for exactly this purpose.
- Both dynamically-declared slots (`conversation.session.header.actions`, scope `session`; `shell.overlay`, scope `root`) are reached through `ctx.slots.inject(key, factory)`, not a direct `ctx.slots.register(...)` call — confirmed against a real running `dsh --profile web` instance that a direct call races the owning plugin's own declaration and throws `slot "..." is not declared` (the boot graph's per-package `inject` metadata is informational, not an activation-order guarantee — see `packages/client/modules/src/client/manifest.ts`'s `WebBootEntry.inject` doc in deepseek-harness). `ctx.slots.inject` is the pattern `ui-jobs`/`ui-subagent`/`ui-agent-preset` already use for the same slot.

## Settings persistence: `localStorage`, not the Host settings document

The "Vim Keymap" card (`settings.plugin.item`, declared by
`@deepseek-ai/dsh-client-ui-settings-plugins`) is a genuine public list slot —
registering into it the same `ctx.slots.inject` way as the other two slots
above works fine. A real `ctx.settings` registration for its one field (the
mode-badge display policy) does not: confirmed against a real running `dsh
--profile web` instance, writing through the registered namespace fails with

```json
{"error":{"code":"settings-not-exposed","message":"settings namespace \"dsh-vim-keymap\" is not exposed to configuration clients"}}
```

The root cause is `packages/host/apiproxy/src/api-proxy.ts`'s
`WEB_SETTINGS_NAMESPACES` — a hardcoded allowlist the Host gateway checks on
every settings read/write, independent of whether the owning plugin ever
registered a schema. That file's own comment names this as a known gap:
extending the allowlist via each plugin's own `settings.register()` call,
so a plugin could expose its own configuration without a change to that
package, is undone "deferred work". Until upstream does that, there is no
extension point a plugin can use, and editing that allowlist directly would
be editing deepseek-harness itself — the one thing this plugin never does.

So `src/client/settings/local-store.ts` persists to `localStorage` instead:
plain, synchronous, no Host round-trip, no allowlist. The card's copy says so
explicitly ("Saved in this browser only, not synced with your account.")
rather than implying Host-document persistence it cannot deliver.

While this was still wired to the real `SettingsScope`, `useSyncExternalStore(settings.subscribe, settings.getSnapshot)`
crashed with `Cannot read properties of undefined (reading 'store')` — the
real controller's `getSnapshot`/`subscribe` are ordinary prototype methods,
and passing them as bare references extracts them from `this`. A dev-harness
mock scope built as a plain object of closures never caught this (no `this`
to lose), which is why `LocalKeymapSettingsStore` deliberately defines
`getSnapshot`/`subscribe` as arrow-function class fields instead of ordinary
methods — bound once at construction, safe to pass around bare.

## Client bundle format

`dsh-client-modules` (deepseek-harness's browser plugin loader) fetches `/plugins/<id>/client.js` and expects it wrapped as `window.__ModuleLoader__.load({ id, factory: (require) => {...} })`, with only a fixed set of specifiers (`react`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-ui-slots`, …) answerable through `require()` — everything else must be bundled in. The preset that builds this (`packages/client/tsdown.client.ts`) is internal to that monorepo and not exported for third-party reuse, so `tsdown.config.ts` here reimplements just the observable wire contract (banner/footer wrapper, the externals list, force-bundling everything else) against deepseek-harness's own published source — not by importing it.

`package.json`'s `exports` map must also list `"./package.json": "./package.json"` — `dsh-client-modules` resolves a candidate plugin's `dsh.client` declaration via `require.resolve("<pkg>/package.json")`, and Node's `exports` field silently rejects that subpath otherwise (the resolver's catch treats it identically to "not a client package", so the whole plugin was accepted onto the boot graph but never actually fetched, with no error).

## Known limitations / follow-up work

- **Command mode has no command vocabulary yet.** It is the palette shell only (portal mount, flavor-specific styling, submit/cancel keys) — submitting a typed command currently just closes the palette without acting on it. Designing the actual `normal`/`session` command sets is separate, product-facing work.
- **`focusSearch()` is a stub.** `ui-workspace`'s `WorkspaceBrowser.tsx` renders at least three `<input type="text">` elements (rename dialog, workspace-path field, session search); a real-browser check is needed to find a selector that reliably picks the search box and not, say, an open rename dialog.
- **Shortcuts (`enterNormal`/`enterSession`/`submit` in `src/config.ts`) are still hardcoded constants, not user-editable.** The mode-indicator display policy no longer has this limitation — it is wired to the "Vim Keymap" settings card (see "Settings persistence" above). Making the shortcuts themselves configurable needs a key-combo parser (matching strings like `"Shift+Escape"` against a live `KeyboardEvent`) that does not exist yet; deferred as separate, larger work rather than guessed at.
- **`@deepseek-ai/dsh-client-*`'s `latest` npm dist-tag is currently broken** (`0.0.1-rc.1` depends on `@deepseek-ai/dsh-compact`, `@deepseek-ai/dsh-client-ui-slash`, and `@deepseek-ai/dsh-type-meta`, none of which are published) — this repo pins the `next` dist-tag (`0.1.0-rc.6`) instead, which resolves cleanly. Worth reporting upstream.
- **Real human IME composition is still unverified.** `e.isComposing` bypasses are unit-tested and the logic is sound, but a genuine OS IME session needs a human at a keyboard — automated browser tools cannot drive one.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

### Fast local loop: dev-harness

`dev-harness/` is a Vite-served page that mounts the real built `lib/` output (not a reimplementation) against mock composer/tree DOM matching the host's real shapes. It is not part of the published plugin — see `dev-harness/README.md`. Use it for quick iteration without starting a `dsh` instance:

```sh
pnpm run build   # dev-harness imports lib/, not src/
pnpm run dev:harness
```

### Real dsh verification

This has been exercised against a real running `dsh --profile web` instance (all four modes and the settings card, confirmed in a real browser, not assumed). To do the same:

1. `pnpm run build` (must include the `tsdown` step — the plain `tsc` output alone is not a servable client bundle; see "Client bundle format" above).
2. Pick a `dsh` home — a scratch one is safer than your real `~/.dsh` (`export DSH_HOME=/path/to/scratch`), then run `dsh --profile web --help` once to auto-initialize `$DSH_HOME/profiles/web/`.
3. Add this package to `$DSH_HOME/profiles/web/package.json`'s `dependencies`: `"dsh-vim-keymap": "link:/absolute/path/to/this/repo"`, then `pnpm install` inside that profile directory.
4. Add a row to `$DSH_HOME/profiles/web/cordis.patch.yml`: `- insert:\n    - id: dsh-vim-keymap\n      name: dsh-vim-keymap`.
5. `dsh --profile web` — no changes to deepseek-harness itself are required at any step.
