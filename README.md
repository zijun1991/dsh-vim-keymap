# dsh-vim-keymap

**English** | [中文](README.zh.md)

Vim keybindings for the [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI, shipped as an independent, out-of-tree Cordis plugin — it never modifies deepseek-harness itself.

## Scope: vim-style keyboard assist, not a vim reimplementation

The goal here is narrow on purpose: let the composer and session tree be
driven from the keyboard the way vim habits already know, not reproduce vim
itself. The actual work in a deepseek-harness session — writing, editing,
searching, running things — is carried out by the agent, not by a human
doing character-by-character text manipulation the way a real vim session
assumes; investing in vim's full surface (registers, macros, marks,
jumplists, custom text objects, a real ex-command language) would spend
effort on capability nobody using this plugin is positioned to exercise.

So new behavior gets added when it removes a specific, concrete keyboard
friction — Shift+Esc needing to reach Session mode even when focus has
drifted off the composer, a double-tapped Escape as a way back in when
nothing else is listening, one `save` command that replaces a mouse click on
the host's "Session log" button — not to chase feature parity with a
`.vimrc`-grade vim setup. Normal mode's text editing stays exactly what
`@replit/codemirror-vim` ships out of the box, unextended; Command mode's
vocabulary staying at one command (see "Known limitations" below) is this
principle in practice, not an oversight.

## Modes

```
Insert (default, composer textarea)
  Esc            -> Normal
  Shift+Esc      -> Session (works from ANY focus/mode state — see below)
  Enter          -> newline (this plugin enforces it — see below)
  Cmd/Alt+Enter  -> send (untouched; Cmd/Alt is what tells it apart from a bare Enter)
  Esc Esc        -> (rescue) force Insert + refocus the composer, from ANY mode/focus state

Normal (real vim text editing, inside the composer textarea)
  j/k            -> move one line up/down (real line motion, not visual-wrap)
  :              -> Command (normal flavor)
  i/a/o/...      -> Insert

Session (workspace/session tree navigation, not text)
  j/k            -> move highlight
  Enter          -> on a workspace row: fold/unfold; on a session/search-result
                    row: open it and return straight to Insert (composer refocused)
  /              -> focus the host's session search
  :              -> Command (session flavor)
  Esc            -> straight to Insert (composer refocused)

Command (one global floating input, two visually distinct flavors)
  save           -> (normal flavor only) click the host's own "Session log"
                    download button — see "Known limitations" for the rest
                    of the vocabulary, which is still just the palette shell
```

A small mode badge (bottom-right, non-interactive, reads `Vim Mode: <MODE>`)
shows which of the four modes is live — the only visual cue for it, since
nothing in the host UI otherwise indicates vim state. Its display policy —
`'persistent'` (always shown, the default), `'on-change'` (shown for ~1.2s
after a transition, then hidden), or `'hidden'` — and the `enterNormal`/
`enterSession` shortcuts themselves (default `Escape`/`Shift+Escape`) are all
user-editable through a "Vim Keymap" card this plugin registers into
Settings → Plugins → Plugin configuration, backed by `localStorage` (see
"Settings persistence" below for why not the Host settings document).
`enterSession` is a global shortcut, not scoped to the composer having focus
— see below.

The Enter/send convention is enforced, not left to the host's own default:
confirmed against a real running `dsh --profile web` instance that the
host's own bubble-phase handler treats a bare Enter as "send" by default,
the opposite of this plugin's agreed convention. `textarea-adapter.ts`
intercepts a bare Enter in Insert mode — `preventDefault()` (relying on the
browser's own native newline-insertion default silently did nothing; some
handler upstream of this listener already calls `preventDefault()` on a
bare Enter) and inserts the `'\n'` itself through `inputActions.setDraft()`
— while the platform send combo (Cmd+Enter on Mac, Alt+Enter elsewhere)
passes through completely untouched.

`enterSession` (Shift+Escape by default) is handled as a global,
focus-independent keydown listener in `RootOverlay.tsx`, not scoped to the
composer textarea the way `enterNormal` is: unlike entering Normal mode,
which inherently needs the textarea focused (it means "vim-edit THIS text
field"), jumping to Session has no such requirement. It used to live in
`textarea-adapter.ts` alongside `enterNormal`, which meant it silently did
nothing whenever focus had drifted away from the composer — confirmed
against a real running dsh instance — the same class of problem the
double-Escape rescue below exists for.

The double-Escape rescue (`RootOverlay.tsx`) exists because every other
keydown listener this plugin installs is scoped to somewhere specific — the
composer textarea for Insert/Normal, the document but only while Session is
current — so if browser focus drifts anywhere else (a host button, nothing
in particular), NOTHING is listening for Escape and there is no keyboard way
back in short of clicking the composer by hand. A quick double-tap of a bare
Escape always works regardless of current mode or focus target, forcing
Insert and refocusing the composer.

Normal mode's `j`/`k` move one real line at a time, which needs the shadow
`EditorView` connected to the actual rendered document: CodeMirror computes
`j`/`k` motion from real pixel line heights/positions, and a view that's
never appended anywhere reads every line as zero-height — confirmed against
a real running dsh instance with genuine multi-line text that this
degenerated into jumping straight between the document's first and last
line instead of moving one at a time. `engine.ts`'s constructor now appends
the view into an `aria-hidden`, `visibility: hidden`, off-screen host div —
genuinely laid out, but never visible, focusable, or reachable by a screen
reader — instead of leaving it fully detached.

Entering Normal mode also clamps the caret the same way real vim does:
pressing Esc right after typing (the common case, caret sitting one past the
last character of a line) pulls it back onto that character rather than
leaving it at an Insert-only position with no further rightward motion
possible — confirmed against a real running dsh instance that this doesn't
happen for free. `@replit/codemirror-vim` only applies that clamp as part of
handling a real "leave insert mode" keystroke; `syncFromHost` never
dispatches one (it replaces the document/selection directly via
`EditorState.create`), so `engine.ts`'s `clampToNormalModeCaret` does it
explicitly, and `textarea-adapter.ts` reads the corrected position back onto
the host textarea (nothing else does, unlike every later onChange-driven edit).

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
above works fine. A real `ctx.settings` registration for its fields (the
mode-badge display policy, the `enterNormal`/`enterSession` shortcuts) does
not: confirmed against a real running `dsh --profile web` instance, writing
through the registered namespace fails with

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

- **Command mode's vocabulary has exactly one command: `save` (normal flavor only).** It clicks the host's own "Session log" button (the closest existing UI affordance to "save this session" — there is no `InputActions`/`SessionInput` verb for it; see `src/client/session/session-log-bridge.ts`), matched by that button's visible text since it carries no `aria-label` and its CSS class is build-hashed. Everything else about the palette is still shell only (portal mount, flavor-specific styling, submit/cancel keys) — this is deliberate scope, not an oversight (see "Scope" above): a session-flavor command or a richer normal-flavor vocabulary is separate, concrete-need-driven work, not growth toward a "complete" vim command set.
- **`focusSearch()` drives the real session-search input**, confirmed against a real running `dsh --profile web` instance: `ui-workspace`'s `WorkspaceBrowser.tsx` renders it as a plain, always-present `<input type="text">` with no distinguishing `aria-label`/stable class, starting visually collapsed (`opacity: 0`, `pointer-events: none`) until its sibling toggle button is clicked — a bare `.focus()` alone does nothing (confirmed live after an earlier false positive from a stale prior click), so `src/client/workspace/tree-bridge.ts` clicks that toggle (found structurally, as the input's only sibling carrying `aria-expanded` — locale/build-independent, unlike its Chinese `aria-label`) before focusing. The one other `<input type="text">` seen on screen — the rename-workspace dialog's name field — only exists while that dialog's `role="dialog"` wrapper is mounted, which is what tells the two apart.
- **`enterNormal`/`enterSession` are now user-editable** through the "Vim Keymap" settings card, backed by a small key-combo parser (`src/key-combo.ts`) that matches strings like `"Shift+Escape"` against a live `KeyboardEvent`. The `submit` constant that used to sit alongside them in `src/config.ts` was dropped rather than carried forward: this plugin never intercepts the host's own send shortcut (see the Modes diagram above — "untouched"), so a setting for it could never have done anything; `src/config.ts` itself was dead code (nothing imported it) and was deleted once `src/settings.ts` became the real, live-editable source of truth for these defaults.
- **`@deepseek-ai/dsh-client-*`'s `latest` npm dist-tag is currently broken** (`0.0.1-rc.1` depends on `@deepseek-ai/dsh-compact`, `@deepseek-ai/dsh-client-ui-slash`, and `@deepseek-ai/dsh-type-meta`, none of which are published) — this repo pins the `next` dist-tag (`0.1.0-rc.6`) instead, which resolves cleanly. Worth reporting upstream.

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
