/**
 * Durable vim-keymap settings: the mode-badge display policy, the
 * Insert -> Normal shortcut (`enterNormal`), and the "jump to Session"
 * shortcut (`enterSession`, honored from both Insert and Normal — see
 * textarea-adapter.ts). The send shortcut is InputBar's own native binding
 * and this plugin never intercepts it, so there is nothing of its to make
 * configurable — see README.md. Persisted client-side only, in `localStorage`
 * (src/client/settings/local-store.ts) — not through `ctx.settings`/the Host
 * settings document. An earlier version of this file also held a
 * schemastery schema for a real `ctx.settings` registration; that path
 * turned out to be a dead end for an out-of-tree plugin (confirmed against a
 * real running dsh instance: the Host gateway's `WEB_SETTINGS_NAMESPACES`
 * allowlist in `packages/host/apiproxy/src/api-proxy.ts` refuses any
 * settings write outside a hardcoded list, independent of whether the
 * owning plugin registered a schema, and that package's own comment names
 * extending it to a plugin's own `settings.register()` call as undone
 * "deferred work" — see local-store.ts and README.md for the full account),
 * so it was removed rather than left half-wired.
 *
 * `enterNormal`/`enterSession` are stored as the same combo-string shape
 * `key-combo.ts` parses (e.g. `"Shift+Escape"`) — see that module for the
 * matching semantics against a live `KeyboardEvent`. `src/config.ts` used to
 * hold these as hardcoded constants nothing ever imported (dead code); it
 * was deleted once these became the real, live-editable source of truth.
 */

/** Key prefix used for this plugin's `localStorage` entry (see local-store.ts). */
export const VIM_KEYMAP_SETTINGS_NAMESPACE = 'dsh-vim-keymap'

/** Mode-badge display policies accepted at the settings boundary. */
export const MODE_INDICATOR_DISPLAYS = ['persistent', 'on-change', 'hidden'] as const

/** Mode-badge display policy: always shown, shown only for a moment after a transition, or never shown. */
export type ModeIndicatorDisplay = typeof MODE_INDICATOR_DISPLAYS[number]

/** Durable section shared by the settings card and `localStorage`. */
export interface VimKeymapSettings {
  readonly modeIndicator: ModeIndicatorDisplay
  /** Insert -> Normal shortcut, as a `key-combo.ts` combo string (default `"Escape"`). */
  readonly enterNormal: string
  /** Insert/Normal -> Session shortcut, as a `key-combo.ts` combo string (default `"Shift+Escape"`). */
  readonly enterSession: string
}

/** Default section when `localStorage` has no override. */
export const DEFAULT_VIM_KEYMAP_SETTINGS: VimKeymapSettings = {
  modeIndicator: 'persistent',
  enterNormal: 'Escape',
  enterSession: 'Shift+Escape',
}
