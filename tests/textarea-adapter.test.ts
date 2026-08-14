/**
 * Integration test for the real production path: a live `keydown` fired on
 * an actual `<textarea>` in the DOM, forwarded into the shadow engine from
 * inside that event's own listener. The original spike test
 * (spike-codemirror-vim-headless.test.ts) only ever dispatched brand-new,
 * never-yet-dispatched KeyboardEvents directly onto the shadow view, which
 * hid a real bug: forwarding the SAME event object that is still mid-dispatch
 * on its original target throws `InvalidStateError` per the DOM spec. This
 * suite exercises the actual call path (attachTextareaAdapter's listener) to
 * catch that class of bug.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { attachTextareaAdapter } from '../src/client/normal/textarea-adapter.ts'
import { CodeMirrorVimEngine } from '../src/client/normal/engine.ts'
import { ModeMachine } from '../src/mode-machine.ts'
import { parseKeyCombo } from '../src/key-combo.ts'

beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = function getClientRects(this: Range) {
      return { length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList
    }
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = function getBoundingClientRect(this: Range) {
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect
    }
  }
})

function press(el: HTMLElement, init: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

describe('attachTextareaAdapter (real host keydown -> shadow engine)', () => {
  it('does not throw forwarding a live host keydown into the engine, and applies the edit', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello world'
    document.body.appendChild(textarea)

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    mode.enterNormal() // as the real Esc handler in this same file would do
    engine.syncFromHost(textarea.value, { start: 0, end: 0 })

    expect(() => { press(textarea, { key: 'w' }) }).not.toThrow()
    expect(() => { press(textarea, { key: 'x' }) }).not.toThrow()
    expect(setDraft).toHaveBeenCalledWith('hello orld')

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('lets Cmd/Meta-key combinations through untouched, even in Normal mode', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello'
    document.body.appendChild(textarea)

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })
    mode.enterNormal()
    engine.syncFromHost(textarea.value, { start: 0, end: 0 })

    let sawDefaultPrevented = false
    textarea.addEventListener('keydown', (e) => { sawDefaultPrevented = e.defaultPrevented })
    press(textarea, { key: 'c', metaKey: true })

    expect(sawDefaultPrevented).toBe(false) // Cmd+C must reach the browser's own copy handling
    expect(setDraft).not.toHaveBeenCalled() // and must never reach the vim engine

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('never hijacks Escape while a CJK/IME composition is in progress', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    let sawDefaultPrevented = false
    textarea.addEventListener('keydown', (e) => { sawDefaultPrevented = e.defaultPrevented })
    press(textarea, { key: 'Escape', isComposing: true })

    expect(sawDefaultPrevented).toBe(false) // the IME must be able to cancel its own composition
    expect(mode.current.mode).toBe('insert') // must not have entered Normal mode

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('no longer treats Shift+Escape as its own concern — that shortcut is RootOverlay.tsx\'s global listener now (see tests/root-overlay.test.tsx)', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)
    textarea.focus()

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    press(textarea, { key: 'Escape', shiftKey: true })

    expect(mode.current.mode).toBe('insert') // unchanged: this adapter alone no longer acts on it
    expect(document.activeElement).toBe(textarea) // and does not blur it either

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('pulls the caret back onto the last character of a line on entering Normal mode (real vim\'s own Insert->Normal clamp)', async () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(5, 5) // Insert-mode-style caret right after 'o'

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    press(textarea, { key: 'Escape' })
    expect(mode.current.mode).toBe('normal')

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(textarea.selectionStart).toBe(4)
    expect(textarea.selectionEnd).toBe(4)

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('inserts a newline for a bare Enter instead of letting the host treat it as "send"', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(5, 5)

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    let bubbledPastTextarea = false
    const onDocumentKeyDown = (): void => { bubbledPastTextarea = true }
    document.addEventListener('keydown', onDocumentKeyDown)
    press(textarea, { key: 'Enter' })
    document.removeEventListener('keydown', onDocumentKeyDown)

    expect(setDraft).toHaveBeenCalledWith('hello\n')
    expect(bubbledPastTextarea).toBe(false) // the host's own submit-on-Enter handler must never see it
    expect(mode.current.mode).toBe('insert') // Enter is not a mode-entry key

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('lets the platform send combo (Cmd+Enter on Mac, Alt+Enter elsewhere) reach the host untouched', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(5, 5)

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    const isMac = /mac/i.test(navigator.platform || navigator.userAgent || '')
    let bubbledToDocument = false
    const onDocumentKeyDown = (): void => { bubbledToDocument = true }
    document.addEventListener('keydown', onDocumentKeyDown)
    press(textarea, isMac ? { key: 'Enter', metaKey: true } : { key: 'Enter', altKey: true })
    document.removeEventListener('keydown', onDocumentKeyDown)

    expect(bubbledToDocument).toBe(true) // the host's own submit handler must see it
    expect(setDraft).not.toHaveBeenCalled() // this adapter must never touch the draft for the send combo

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('honors a live-configured enterNormal combo instead of the Escape default', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)
    textarea.focus()

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const enterNormal = parseKeyCombo('Ctrl+j')
    if (enterNormal === null) throw new Error('unreachable')
    const keymap = { current: { enterNormal } }
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft }, keymap })

    press(textarea, { key: 'Escape' }) // the default combo must no longer fire
    expect(mode.current.mode).toBe('insert')

    press(textarea, { key: 'j', ctrlKey: true })
    expect(mode.current.mode).toBe('normal')

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })
})
