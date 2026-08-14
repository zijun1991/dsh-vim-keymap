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

describe('CodeMirrorVimEngine (Normal-mode caret clamp on syncFromHost)', () => {
  it('pulls a caret sitting past the last character of a line back onto that character', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('hello', { start: 5, end: 5 }) // Insert-mode-style caret right after 'o'
    expect(engine.currentSelection()).toEqual({ start: 4, end: 4, direction: 'forward' })

    engine.destroy()
  })

  it('leaves a mid-line caret untouched', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('hello', { start: 2, end: 2 })
    expect(engine.currentSelection()).toEqual({ start: 2, end: 2, direction: 'forward' })

    engine.destroy()
  })

  it('clamps onto the last character of the CURRENT line, not the whole document, for multi-line text', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('ab\ncd', { start: 2, end: 2 }) // right after 'b', at the line-1/line-2 boundary
    expect(engine.currentSelection()).toEqual({ start: 1, end: 1, direction: 'forward' })

    engine.destroy()
  })

  it('leaves position 0 on an empty line untouched (nothing to pull back onto)', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('', { start: 0, end: 0 })
    expect(engine.currentSelection()).toEqual({ start: 0, end: 0, direction: 'forward' })

    engine.destroy()
  })

  it('does not clamp an actual (non-collapsed) selection', () => {
    const engine = new CodeMirrorVimEngine()
    engine.syncFromHost('hello', { start: 2, end: 5 })
    expect(engine.currentSelection()).toEqual({ start: 2, end: 5, direction: 'forward' })

    engine.destroy()
  })
})
