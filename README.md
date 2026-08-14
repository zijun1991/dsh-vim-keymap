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
  h/l            -> fold/unfold
  Enter          -> open the highlighted row
  /              -> focus the host's session search (not yet wired, see below)
  :              -> Command (session flavor)
  Esc            -> straight to Insert

Command (one global floating input, two visually distinct flavors)
```

## Why this never touches deepseek-harness

Every integration point is either an existing, general-purpose extension point, or driven off already-public, already-rendered state:

- **Normal mode** reaches the composer's `useInput`/`inputActions` by registering a headless (render-nothing) component into `conversation.session.header.actions` — a `list`-kind slot `ui-conversation` already declares for third-party header buttons. It never registers into `conversation.composer.bar` (InputBar's own exclusive slot) and never imports InputBar internals. Real text editing runs on a headless `@codemirror/view` `EditorView` with `@replit/codemirror-vim`, never mounted to visible DOM; edits flow back through `inputActions.setDraft()`, the same public write path InputBar itself uses.
- **Session mode** never imports `ui-workspace` or its view store. It reads the workspace tree straight off the rendered, accessible DOM (`role="tree"`/`role="treeitem"`/`aria-expanded`) and drives fold/expand and row-open by dispatching real `click` events on the row elements — the same thing a mouse user does. `ui-workspace`'s internal store is never touched.
- **Command mode** portals into `document.body`, and the whole plugin's global surface (the Session-mode overlay + Command palette) registers into `shell.overlay`, the additive global-overlay slot `ui-layout` documents for exactly this purpose.

## Known limitations / follow-up work

- **Command mode has no command vocabulary yet.** It is the palette shell only (portal mount, flavor-specific styling, submit/cancel keys) — submitting a typed command currently just closes the palette without acting on it. Designing the actual `normal`/`session` command sets is separate, product-facing work.
- **`focusSearch()` is a stub.** `ui-workspace`'s `WorkspaceBrowser.tsx` renders at least three `<input type="text">` elements (rename dialog, workspace-path field, session search); a real-browser check is needed to find a selector that reliably picks the search box and not, say, an open rename dialog.
- **Shortcuts are hardcoded constants (`src/config.ts`), not wired to `ctx.settings`.** Wiring live, user-editable shortcuts needs the Node-side `@deepseek-ai/dsh-settings` registration plus the browser-side `SettingsScope` binding (`dsh-client-runtime`'s `contract/settings-scope.ts`) — deferred rather than guessed at, since neither was exercised against a running instance.
- **No real-browser verification yet.** Everything above typechecks against the real, published `@deepseek-ai/dsh-client-*@0.1.0-rc.6` API and passes a jsdom-based unit/spike suite, but has not been exercised inside an actual running `dsh --profile web` instance in a browser (deferred per current project instructions). In particular: whether the headless CodeMirror 6 `EditorView`'s cursor *measurement* (not just its logic) behaves correctly when never attached to the visible document is unverified — jsdom implements no layout at all (see `tests/spike-codemirror-vim-headless.test.ts`), so this can only be confirmed in a real browser.
- **`@deepseek-ai/dsh-client-*`'s `latest` npm dist-tag is currently broken** (`0.0.1-rc.1` depends on `@deepseek-ai/dsh-compact`, `@deepseek-ai/dsh-client-ui-slash`, and `@deepseek-ai/dsh-type-meta`, none of which are published) — this repo pins the `next` dist-tag (`0.1.0-rc.6`) instead, which resolves cleanly. Worth reporting upstream.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

Mounting into a real `dsh` instance for manual verification: add this package to a `dsh` home's `cordis.patch.yml` as an out-of-tree plugin (see deepseek-harness's `docs/architecture.md`, "Profiles and bundles") — no changes to deepseek-harness itself are required.
