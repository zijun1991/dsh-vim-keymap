/**
 * Durable vim-keymap settings: currently just the mode-badge display policy.
 * Persisted client-side only, in `localStorage` (src/client/settings/local-store.ts)
 * — not through `ctx.settings`/the Host settings document. An earlier version
 * of this file also held a schemastery schema for a real `ctx.settings`
 * registration; that path turned out to be a dead end for an out-of-tree
 * plugin (confirmed against a real running dsh instance: the Host gateway's
 * `WEB_SETTINGS_NAMESPACES` allowlist in `packages/host/apiproxy/src/api-proxy.ts`
 * refuses any settings write outside a hardcoded list, independent of
 * whether the owning plugin registered a schema, and that package's own
 * comment names extending it to a plugin's own `settings.register()` call as
 * undone "deferred work" — see local-store.ts and README.md for the full
 * account), so it was removed rather than left half-wired.
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
}

/** Default section when `localStorage` has no override. */
export const DEFAULT_VIM_KEYMAP_SETTINGS: VimKeymapSettings = { modeIndicator: 'persistent' }
