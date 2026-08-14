/** ModeIndicator against the real LocalKeymapSettingsStore (jsdom's localStorage), not a fake. */

import { afterEach, describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ModeMachine } from '../src/mode-machine.ts'
import { LocalKeymapSettingsStore } from '../src/client/settings/local-store.ts'
import { ModeIndicator } from '../src/client/overlay/ModeIndicator.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { localStorage.clear() })

describe('ModeIndicator', () => {
  it('shows the persistent badge by default', () => {
    const mode = new ModeMachine()
    const settings = new LocalKeymapSettingsStore()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => { root.render(createElement(ModeIndicator, { mode, settings })) })

    expect(document.body.textContent).toContain('Vim Mode: INSERT')

    act(() => { root.unmount() })
    container.remove()
  })

  it('hides immediately when the settings card switches the policy to hidden', () => {
    const mode = new ModeMachine()
    const settings = new LocalKeymapSettingsStore()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => { root.render(createElement(ModeIndicator, { mode, settings })) })
    expect(document.body.textContent).toContain('Vim Mode: INSERT')

    act(() => { settings.setModeIndicator('hidden') })
    expect(document.body.textContent).not.toContain('Vim Mode:')

    act(() => { root.unmount() })
    container.remove()
  })
})
