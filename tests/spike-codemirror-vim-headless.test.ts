/**
 * Phase 0 spike: does @replit/codemirror-vim work as a pure computation
 * engine on an EditorView that is never attached to a visible document, or
 * does it silently depend on being connected/laid out?
 *
 * Finding: jsdom implements no layout at all — `Range` has no
 * `getClientRects`/`getBoundingClientRect`, which CM6's cursor-measurement
 * plugin calls unconditionally, and construction throws without a stub. A
 * real browser implements both; jsdom does not even stub them. The stubs
 * below let the vim/document *logic* run in this suite, but they prove
 * nothing about real on-screen measurement — only real-browser e2e (deferred
 * per current instructions) can confirm the shadow EditorView measures
 * correctly when genuinely detached in a browser.
 *
 * Also: `@replit/codemirror-vim`'s internal `vimState` has no `mode: string`
 * field — mode is derived from `insertMode`/`visualMode`/`visualLine`/
 * `visualBlock` booleans (all false = normal). And it starts in vim's Normal
 * mode by default (`insertMode: false` at construction) — real vim's own
 * default, which happens to match what this bridge wants on every
 * (re)sync: no extra "force normal" step is needed after `syncFromHost`.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, vim } from '@replit/codemirror-vim'

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

/** Mirrors this plugin's own vimEngineMode() derivation (see client/normal/engine.ts). */
function deriveMode(vimState: { insertMode: boolean; visualMode: boolean; visualLine: boolean; visualBlock: boolean }): string {
  if (vimState.insertMode) return 'insert'
  if (vimState.visualMode) return vimState.visualLine ? 'visual-line' : 'visual'
  return 'normal'
}

describe('headless codemirror-vim engine (jsdom logic only — geometry is stubbed, see file doc)', () => {
  it('starts in normal mode and processes motions/edits on a detached EditorView', () => {
    const state = EditorState.create({ doc: 'hello world', extensions: [vim()] })
    const view = new EditorView({ state }) // no `parent` — dom is never inserted anywhere
    expect(view.dom.isConnected).toBe(false)

    const cm = getCM(view)
    expect(cm).not.toBeNull()
    if (cm === null) throw new Error('unreachable')
    expect(cm.state.vim).not.toBeNull()
    if (cm.state.vim === null || cm.state.vim === undefined) throw new Error('unreachable')

    expect(deriveMode(cm.state.vim)).toBe('normal')

    // 'w' motion moves the cursor to the start of the next word.
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true, cancelable: true }))
    expect(view.state.selection.main.head).toBe(6) // "hello " is 6 chars; 'w' lands on 'world'

    // 'x' deletes the character under the cursor — proves document mutation works headless too.
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }))
    expect(view.state.doc.toString()).toBe('hello orld')

    // 'i' enters insert mode; Escape returns to normal.
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true }))
    expect(deriveMode(cm.state.vim)).toBe('insert')
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(deriveMode(cm.state.vim)).toBe('normal')

    view.destroy()
  })
})
