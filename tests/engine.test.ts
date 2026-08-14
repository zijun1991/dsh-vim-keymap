/**
 * Regression test for a bug the spike test's single-construction-only setup
 * hid: `syncFromHost` calls `EditorView.setState`, which destroys and
 * reconstructs every ViewPlugin (confirmed against a real browser, not
 * jsdom, via the dsh-vim-keymap dev harness) — so a `getCM(view)` result
 * cached at construction time goes stale the moment the first `syncFromHost`
 * runs, and every mode read after that point reported 'insert' regardless of
 * the engine's real mode. `readMode()` must re-fetch `getCM` every time.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CodeMirrorVimEngine } from '../src/client/normal/engine.ts'

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

describe('CodeMirrorVimEngine (mode reads after re-sync, not just at construction)', () => {
  it('reports normal mode immediately after syncFromHost, and insert mode after a following "i"', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('hello world', { start: 11, end: 11 })
    expect(engine.mode).toBe('normal')

    const modes: Array<CodeMirrorVimEngine['mode']> = []
    engine.onModeChange((m) => { modes.push(m) })

    engine.dispatchKey(new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true }))
    expect(engine.mode).toBe('insert')
    expect(modes).toEqual(['insert'])

    engine.destroy()
  })

  it('reports normal mode again after a second syncFromHost following an earlier one', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('first', { start: 5, end: 5 })
    engine.syncFromHost('second', { start: 6, end: 6 }) // the re-sync that used to strand a stale cm reference
    expect(engine.mode).toBe('normal')

    engine.destroy()
  })
})
