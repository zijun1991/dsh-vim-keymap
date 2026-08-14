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
import { DEFAULT_VIM_KEYMAP_SETTINGS, VIM_KEYMAP_SETTINGS_NAMESPACE } from '../../settings.js'
import type { ModeIndicatorDisplay, VimKeymapSettings } from '../../settings.js'

const STORAGE_KEY = `${VIM_KEYMAP_SETTINGS_NAMESPACE}:settings`

function readStored(): VimKeymapSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_VIM_KEYMAP_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_VIM_KEYMAP_SETTINGS
    const modeIndicator = (parsed as { modeIndicator?: unknown }).modeIndicator
    if (modeIndicator !== 'persistent' && modeIndicator !== 'on-change' && modeIndicator !== 'hidden') {
      return DEFAULT_VIM_KEYMAP_SETTINGS
    }
    return { modeIndicator }
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
    this.value = { ...this.value, modeIndicator: value }
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
