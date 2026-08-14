/**
 * Shortcut defaults. v1 ships these as plain constants rather than wiring
 * `ctx.settings` end-to-end — that integration needs its own verification
 * pass and is tracked as follow-up work, not skipped silently (see
 * README.md). The mode-badge display policy below is the one field that
 * IS wired end-to-end; see src/settings.ts and src/client/settings/.
 */
import { DEFAULT_VIM_KEYMAP_SETTINGS } from './settings.js'
import type { ModeIndicatorDisplay } from './settings.js'

export type { ModeIndicatorDisplay }

export interface KeymapConfig {
  /** Enters vim Normal mode from Insert. */
  readonly enterNormal: string
  /** Enters Session mode from Insert. */
  readonly enterSession: string
  /** Sends the message from Insert mode. */
  readonly submit: string
  /** Mode-badge display policy (see {@link ModeIndicatorDisplay}); live-configurable, see src/settings.ts. */
  readonly modeIndicator: ModeIndicatorDisplay
}

const isMac = typeof navigator === 'object' && /mac/i.test(navigator.platform ?? navigator.userAgent ?? '')

export const DEFAULT_KEYMAP_CONFIG: KeymapConfig = {
  enterNormal: 'Escape',
  enterSession: 'Shift+Escape',
  submit: isMac ? 'Meta+Enter' : 'Alt+Enter',
  modeIndicator: DEFAULT_VIM_KEYMAP_SETTINGS.modeIndicator,
}
