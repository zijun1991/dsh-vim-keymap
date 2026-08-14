/**
 * Shortcut defaults. v1 ships these as plain constants rather than wiring
 * `ctx.settings` end-to-end (Node-side registration + the browser-side
 * `SettingsScope` binding) — that integration needs its own verification pass
 * and is tracked as follow-up work, not skipped silently (see README.md).
 */
/**
 * Mode-badge display policy: always shown, shown only for a moment after a
 * transition, or never shown.
 */
export type ModeIndicatorDisplay = 'persistent' | 'on-change' | 'hidden'

export interface KeymapConfig {
  /** Enters vim Normal mode from Insert. */
  readonly enterNormal: string
  /** Enters Session mode from Insert. */
  readonly enterSession: string
  /** Sends the message from Insert mode. */
  readonly submit: string
  /** Mode-badge display policy (see {@link ModeIndicatorDisplay}). */
  readonly modeIndicator: ModeIndicatorDisplay
}

const isMac = typeof navigator === 'object' && /mac/i.test(navigator.platform ?? navigator.userAgent ?? '')

export const DEFAULT_KEYMAP_CONFIG: KeymapConfig = {
  enterNormal: 'Escape',
  enterSession: 'Shift+Escape',
  submit: isMac ? 'Meta+Enter' : 'Alt+Enter',
  modeIndicator: 'persistent',
}
