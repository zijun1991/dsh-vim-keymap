/** LocalKeymapSettingsStore: localStorage persistence, corrupt-value fallback, cross-tab sync. */

import { afterEach, describe, expect, it } from 'vitest'
import { LocalKeymapSettingsStore } from '../src/client/settings/local-store.ts'
import { VIM_KEYMAP_SETTINGS_NAMESPACE } from '../src/settings.ts'

const STORAGE_KEY = `${VIM_KEYMAP_SETTINGS_NAMESPACE}:settings`

afterEach(() => { localStorage.clear() })

describe('LocalKeymapSettingsStore', () => {
  it('defaults to persistent when nothing is stored', () => {
    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'persistent',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('persists a write and a fresh instance reads it back', () => {
    new LocalKeymapSettingsStore().setModeIndicator('hidden')
    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'hidden',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('notifies subscribers on write', () => {
    const store = new LocalKeymapSettingsStore()
    let calls = 0
    store.subscribe(() => { calls += 1 })
    store.setModeIndicator('on-change')
    expect(calls).toBe(1)
    expect(store.getSnapshot()).toEqual({
      modeIndicator: 'on-change',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('sets a valid shortcut (canonicalizing modifier names) and rejects an unparseable one', () => {
    const store = new LocalKeymapSettingsStore()

    expect(store.setEnterNormal('escape')).toBe(true) // matching is case-insensitive; the key's own case is preserved as typed
    expect(store.getSnapshot().enterNormal).toBe('escape')

    expect(store.setEnterSession('shift+escape')).toBe(true) // modifier names ARE canonicalized ("shift" -> "Shift")
    expect(store.getSnapshot().enterSession).toBe('Shift+escape')

    expect(store.setEnterNormal('')).toBe(false) // empty combo: rejected, no write
    expect(store.getSnapshot().enterNormal).toBe('escape')

    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'persistent',
      enterNormal: 'escape',
      enterSession: 'Shift+escape',
    })
  })

  it('falls back to the default for a corrupt or foreign stored value', () => {
    localStorage.setItem(STORAGE_KEY, '{"modeIndicator":"blinking"}')
    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'persistent',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })

    localStorage.setItem(STORAGE_KEY, 'not json at all')
    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'persistent',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('syncs from a storage event fired by another tab', () => {
    const store = new LocalKeymapSettingsStore()
    let calls = 0
    store.subscribe(() => { calls += 1 })

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modeIndicator: 'hidden' }))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    expect(calls).toBe(1)
    expect(store.getSnapshot()).toEqual({
      modeIndicator: 'hidden',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('falls back per-field: a corrupt shortcut does not discard a valid modeIndicator', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modeIndicator: 'hidden', enterNormal: '', enterSession: 123 }))
    expect(new LocalKeymapSettingsStore().getSnapshot()).toEqual({
      modeIndicator: 'hidden',
      enterNormal: 'Escape',
      enterSession: 'Shift+Escape',
    })
  })

  it('ignores a storage event for an unrelated key', () => {
    const store = new LocalKeymapSettingsStore()
    let calls = 0
    store.subscribe(() => { calls += 1 })

    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-plugin:settings' }))

    expect(calls).toBe(0)
  })
})
