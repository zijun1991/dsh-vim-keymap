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

  it('blurs the textarea on Shift+Escape, so a live IME cannot intercept Session-mode keys', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)
    textarea.focus()

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    expect(document.activeElement).toBe(textarea)
    press(textarea, { key: 'Escape', shiftKey: true })

    expect(mode.current.mode).toBe('session')
    expect(document.activeElement).not.toBe(textarea)

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('also blurs and enters Session on Shift+Escape from Normal mode, not just Insert', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)
    textarea.focus()

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft } })

    mode.enterNormal() // as the real Esc handler would do
    engine.syncFromHost(textarea.value, { start: 0, end: 0 })
    expect(mode.current.mode).toBe('normal')

    press(textarea, { key: 'Escape', shiftKey: true })

    expect(mode.current.mode).toBe('session')
    expect(document.activeElement).not.toBe(textarea)

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })

  it('honors a live-configured keymap instead of the Escape/Shift+Escape defaults', () => {
    const textarea = document.createElement('textarea')
    textarea.value = ''
    document.body.appendChild(textarea)
    textarea.focus()

    const engine = new CodeMirrorVimEngine()
    const mode = new ModeMachine()
    const setDraft = vi.fn()
    const enterNormal = parseKeyCombo('Ctrl+j')
    const enterSession = parseKeyCombo('Ctrl+k')
    if (enterNormal === null || enterSession === null) throw new Error('unreachable')
    const keymap = { current: { enterNormal, enterSession } }
    const adapter = attachTextareaAdapter({ textarea, engine, mode, inputActions: { setDraft }, keymap })

    press(textarea, { key: 'Escape' }) // the default combo must no longer fire
    expect(mode.current.mode).toBe('insert')

    press(textarea, { key: 'j', ctrlKey: true })
    expect(mode.current.mode).toBe('normal')

    mode.enterInsert()
    textarea.focus()
    press(textarea, { key: 'k', ctrlKey: true })
    expect(mode.current.mode).toBe('session')

    adapter.dispose()
    engine.destroy()
    textarea.remove()
  })
})
