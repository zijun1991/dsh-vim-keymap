/**
 * Browser-local persistence for `VimKeymapSettings` — `localStorage`, not the
 * Host settings document. Confirmed against a real running dsh instance that
 * the Host path is architecturally closed to out-of-tree plugins: the
 * gateway (`packages/host/apiproxy/src/api-proxy.ts`'s `WEB_SETTINGS_NAMESPACES`
 * allowlist) refuses any settings write whose namespace it does not itself
 * list, independent of whether the owning plugin registered a schema — its
 * own comment there names this "deferred work" for a plugin to expose its
 * own configuration without a change to that package. Registering a real
 * `ctx.settings` namespace from this plugin therefore silently produces a
 * `settings-not-exposed` write failure with no upstream extension point
 * available; this file replaces that dead path entirely (see README.md).
 */
import { formatKeyCombo, parseKeyCombo } from '../../key-combo.js'
import { DEFAULT_VIM_KEYMAP_SETTINGS, MODE_INDICATOR_DISPLAYS, VIM_KEYMAP_SETTINGS_NAMESPACE } from '../../settings.js'
import type { ModeIndicatorDisplay, VimKeymapSettings } from '../../settings.js'

const STORAGE_KEY = `${VIM_KEYMAP_SETTINGS_NAMESPACE}:settings`

/** A stored shortcut is only trusted if it still parses — see key-combo.ts. */
function readShortcut(value: unknown, fallback: string): string {
  return typeof value === 'string' && parseKeyCombo(value) !== null ? value : fallback
}

function readStored(): VimKeymapSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_VIM_KEYMAP_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_VIM_KEYMAP_SETTINGS
    const record = parsed as { modeIndicator?: unknown; enterNormal?: unknown; enterSession?: unknown }
    // Each field falls back to its own default independently — a corrupt
    // shortcut should not also discard an otherwise-valid modeIndicator, and
    // vice versa.
    const modeIndicator = (MODE_INDICATOR_DISPLAYS as readonly unknown[]).includes(record.modeIndicator)
      ? record.modeIndicator as ModeIndicatorDisplay
      : DEFAULT_VIM_KEYMAP_SETTINGS.modeIndicator
    return {
      modeIndicator,
      enterNormal: readShortcut(record.enterNormal, DEFAULT_VIM_KEYMAP_SETTINGS.enterNormal),
      enterSession: readShortcut(record.enterSession, DEFAULT_VIM_KEYMAP_SETTINGS.enterSession),
    }
    // A corrupt/foreign value at this key (hand-edited, or a future version's
    // shape) falls back to the default rather than throwing — this is a
    // cosmetic preference, not something worth breaking the plugin over.
  } catch {
    return DEFAULT_VIM_KEYMAP_SETTINGS
  }
}

/**
 * Holds the current {@link VimKeymapSettings} in `localStorage`, notifying
 * subscribers on every change (including ones made in another tab).
 */
export class LocalKeymapSettingsStore {
  private value: VimKeymapSettings = readStored()
  private readonly listeners = new Set<() => void>()

  constructor() {
    // Cross-tab sync: `storage` only fires in tabs OTHER than the one that
    // wrote, which is exactly what a plain in-memory `listeners` set can't
    // cover on its own.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== null && e.key !== STORAGE_KEY) return
        this.value = readStored()
        this.notify()
      })
    }
  }

  getSnapshot = (): VimKeymapSettings => this.value

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  setModeIndicator(value: ModeIndicatorDisplay): void {
    this.write({ ...this.value, modeIndicator: value })
  }

  /** Sets the Insert -> Normal shortcut (stored in its canonical form); rejects (returns `false`, no write) a combo `key-combo.ts` cannot parse. */
  setEnterNormal(value: string): boolean {
    const combo = parseKeyCombo(value)
    if (combo === null) return false
    this.write({ ...this.value, enterNormal: formatKeyCombo(combo) })
    return true
  }

  /** Sets the Insert/Normal -> Session shortcut (stored in its canonical form); rejects (returns `false`, no write) a combo `key-combo.ts` cannot parse. */
  setEnterSession(value: string): boolean {
    const combo = parseKeyCombo(value)
    if (combo === null) return false
    this.write({ ...this.value, enterSession: formatKeyCombo(combo) })
    return true
  }

  private write(next: VimKeymapSettings): void {
    this.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value))
      // A write that throws (quota, private-browsing hardening) still keeps
      // the in-memory value and still notifies — the current tab reflects the
      // choice for its lifetime even if it can't outlive a reload.
    } catch { /* best-effort persistence; see getSnapshot's comment */ }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
