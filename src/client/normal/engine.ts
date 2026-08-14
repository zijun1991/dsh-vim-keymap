/**
 * VimEngine implementation backed by a headless (never visibly mounted)
 * CodeMirror 6 `EditorView` running `@replit/codemirror-vim`. Confirmed
 * (see tests/spike-codemirror-vim-headless.test.ts): keydown must be
 * dispatched on `view.contentDOM`, not `view.dom`; `@replit/codemirror-vim`
 * has no `.mode` string — mode is derived from `insertMode`/`visualMode`/
 * `visualLine`/`visualBlock` booleans; a fresh instance starts in vim's
 * Normal mode already, which is exactly the state this bridge wants after
 * every `syncFromHost`.
 *
 * Real on-screen cursor measurement is NOT verified here — jsdom has no
 * layout engine at all (see the spike test's header comment), so this class
 * has only been exercised against jsdom-with-stubbed-geometry. A real browser
 * check is still open work (README.md "Known limitations").
 */
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, vim, type CodeMirror } from '@replit/codemirror-vim'
import type { TextSelection, VimEngine } from '../../bridge/contract.js'

function deriveMode(vimState: { insertMode: boolean; visualMode: boolean; visualLine: boolean }): VimEngine['mode'] {
  if (vimState.insertMode) return 'insert'
  if (vimState.visualMode) return vimState.visualLine ? 'visual-line' : 'visual'
  return 'normal'
}

/** A headless CodeMirror 6 + codemirror-vim instance implementing {@link VimEngine}. */
export class CodeMirrorVimEngine implements VimEngine {
  private readonly view: EditorView
  private readonly extensions: readonly Extension[]
  private readonly changeListeners = new Set<(next: { text: string; sel: TextSelection }) => void>()
  private readonly modeListeners = new Set<(mode: VimEngine['mode']) => void>()
  private lastMode: VimEngine['mode']

  constructor(extraExtensions: readonly Extension[] = []) {
    this.extensions = [vim(), ...extraExtensions]
    const state = EditorState.create({ doc: '', extensions: this.extensions })
    this.view = new EditorView({ state }) // intentionally never appended to `document`
    if (this.cm() === null) throw new Error('dsh-vim-keymap: @replit/codemirror-vim did not attach to the shadow EditorView')
    this.lastMode = this.readMode()
  }

  /**
   * Re-fetched on every read, never cached: `getCM` returns `view.cm`, a
   * property the vim ViewPlugin sets on the (stable) `EditorView` instance
   * itself. `EditorView.setState` — which `syncFromHost` calls on every
   * Normal-mode entry — destroys and reconstructs every ViewPlugin, so a
   * `cm` reference taken before that point is stale and its `.state` reads
   * back `null` (confirmed against a real browser, not jsdom: `cm.state.vim`
   * read `null` after the first `syncFromHost`, which `readMode()` then
   * misreported as 'insert').
   */
  private cm(): CodeMirror | null {
    return getCM(this.view)
  }

  get mode(): VimEngine['mode'] {
    return this.lastMode
  }

  syncFromHost(text: string, sel: TextSelection): void {
    const clampedAnchor = Math.max(0, Math.min(sel.start, text.length))
    const clampedHead = Math.max(0, Math.min(sel.end, text.length))
    this.view.setState(EditorState.create({
      doc: text,
      selection: { anchor: clampedAnchor, head: clampedHead },
      extensions: this.extensions,
    }))
    this.lastMode = this.readMode()
  }

  dispatchKey(e: KeyboardEvent): boolean {
    const beforeText = this.view.state.doc.toString()
    const beforeSel = this.view.state.selection.main

    // A NEW event, not `e` itself: `e` is still mid-dispatch on the real
    // textarea (this method runs from inside one of its own listeners), and
    // the DOM spec forbids re-dispatching an event while its own dispatch is
    // in progress — `view.contentDOM.dispatchEvent(e)` throws
    // InvalidStateError in that state (verified against a real DOM
    // implementation, not assumed). Cloning the fields CM6/vim actually reads
    // sidesteps that entirely.
    const clone = new KeyboardEvent('keydown', {
      key: e.key,
      code: e.code,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
      bubbles: true,
      cancelable: true,
    })
    // CM6/codemirror-vim key handling lives on contentDOM; `dispatchEvent`'s
    // return value reports `preventDefault()`, which is what "consumed" means here.
    const notCancelled = this.view.contentDOM.dispatchEvent(clone)
    const consumed = !notCancelled

    const mode = this.readMode()
    if (mode !== this.lastMode) {
      this.lastMode = mode
      for (const listener of this.modeListeners) listener(mode)
    }

    const afterText = this.view.state.doc.toString()
    const afterSel = this.view.state.selection.main
    if (afterText !== beforeText || afterSel.anchor !== beforeSel.anchor || afterSel.head !== beforeSel.head) {
      const next = { text: afterText, sel: toTextSelection(afterSel) }
      for (const listener of this.changeListeners) listener(next)
    }
    return consumed
  }

  onChange(cb: (next: { text: string; sel: TextSelection }) => void): () => void {
    this.changeListeners.add(cb)
    return () => { this.changeListeners.delete(cb) }
  }

  onModeChange(cb: (mode: VimEngine['mode']) => void): () => void {
    this.modeListeners.add(cb)
    return () => { this.modeListeners.delete(cb) }
  }

  destroy(): void {
    this.changeListeners.clear()
    this.modeListeners.clear()
    this.view.destroy()
  }

  private readMode(): VimEngine['mode'] {
    const cm = this.cm()
    const vimState = cm === null ? null : cm.state.vim
    return vimState === null || vimState === undefined ? 'insert' : deriveMode(vimState)
  }
}

function toTextSelection(range: { anchor: number; head: number }): TextSelection {
  return {
    start: Math.min(range.anchor, range.head),
    end: Math.max(range.anchor, range.head),
    direction: range.head < range.anchor ? 'backward' : 'forward',
  }
}
