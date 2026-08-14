/**
 * Coverage for RootOverlay's two always-on, focus-independent keydown
 * effects: the global Shift-Escape "jump to Session" shortcut and the
 * double-Escape rescue back to Insert. Every OTHER keydown listener this
 * plugin installs is scoped to either the composer textarea (Insert/Normal)
 * or the document but only while Session is current — these two are the
 * exceptions, active for the plugin's whole lifetime regardless of mode or
 * where focus actually is (see RootOverlay.tsx's module doc for why).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ModeMachine } from '../src/mode-machine.ts'
import { LocalKeymapSettingsStore } from '../src/client/settings/local-store.ts'
import { createRootOverlay } from '../src/client/overlay/RootOverlay.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function press(init: KeyboardEventInit): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

describe('RootOverlay global keydown effects', () => {
  let composerWrapper: HTMLElement
  let composerTextarea: HTMLTextAreaElement
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    composerWrapper = document.createElement('div')
    composerWrapper.setAttribute('data-composer-card', '')
    composerTextarea = document.createElement('textarea')
    composerWrapper.appendChild(composerTextarea)
    document.body.appendChild(composerWrapper)

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    composerWrapper.remove()
    localStorage.clear()
    vi.useRealTimers()
  })

  describe('Shift-Escape "jump to Session"', () => {
    it('enters Session from Insert even with focus elsewhere, and blurs the composer', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      composerTextarea.focus()
      composerTextarea.blur()
      document.body.focus() // simulate focus never having reached the composer at all

      act(() => { press({ key: 'Escape', shiftKey: true }) })

      expect(mode.current.mode).toBe('session')
      expect(document.activeElement).not.toBe(composerTextarea)
    })

    it('also works from Normal mode', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterNormal() })
      act(() => { press({ key: 'Escape', shiftKey: true }) })

      expect(mode.current.mode).toBe('session')
    })

    it('is a no-op from Session or Command (nothing to jump to)', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterSession() })
      act(() => { press({ key: 'Escape', shiftKey: true }) })
      expect(mode.current.mode).toBe('session') // unchanged, still a no-op

      act(() => { mode.enterInsert() })
      act(() => { mode.enterNormal() })
      act(() => { mode.enterCommand('normal') })
      act(() => { press({ key: 'Escape', shiftKey: true }) })
      expect(mode.current).toEqual({ mode: 'command', commandFlavor: 'normal' })
    })

    it('honors a live-configured enterSession combo instead of the Shift+Escape default', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      settings.setEnterSession('Ctrl+k')
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { press({ key: 'Escape', shiftKey: true }) }) // the default combo must no longer fire
      expect(mode.current.mode).toBe('insert')

      act(() => { press({ key: 'k', ctrlKey: true }) })
      expect(mode.current.mode).toBe('session')
    })
  })

  describe('double-Escape rescue to Insert', () => {
    it('rescues to Insert (and focuses the composer) on a quick double-tap, even with focus elsewhere and in Normal mode', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterNormal() })
      document.body.focus() // simulate focus having drifted away from anything this plugin listens on

      act(() => { press({ key: 'Escape' }) })
      expect(mode.current.mode).toBe('normal') // one tap alone must not rescue

      act(() => { press({ key: 'Escape' }) })
      expect(mode.current.mode).toBe('insert')
      expect(document.activeElement).toBe(composerTextarea)
    })

    it('does not rescue on a single Escape', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterNormal() })
      act(() => { press({ key: 'Escape' }) })

      expect(mode.current.mode).toBe('normal')
    })

    it('does not rescue on two Escapes further apart than the double-tap window', () => {
      vi.useFakeTimers()
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterNormal() })
      act(() => { press({ key: 'Escape' }) })
      act(() => { vi.advanceTimersByTime(1000) }) // well past the window
      act(() => { press({ key: 'Escape' }) })

      expect(mode.current.mode).toBe('normal')
    })

    it('does not confuse a Shift+Escape pair with a double-tap rescue', () => {
      const mode = new ModeMachine()
      const settings = new LocalKeymapSettingsStore()
      act(() => { root.render(createElement(createRootOverlay(mode, settings))) })

      act(() => { mode.enterNormal() })
      act(() => { press({ key: 'Escape', shiftKey: true }) })
      act(() => { press({ key: 'Escape', shiftKey: true }) })

      // Shift+Escape has its own meaning (jump to Session, above) — two of
      // them must land there, not fall through to the bare-Escape rescue.
      expect(mode.current.mode).toBe('session')
    })
  })
})
