/**
 * Bridges a {@link VimEngine} to the real, unmodified composer `<textarea>`,
 * and owns the Insert -> Normal mode-entry key that fires while that
 * textarea has focus (Esc by default — see {@link KeymapRef} for how the
 * settings card overrides this live), plus the Insert-mode Enter/send
 * convention (see {@link isSendCombo}: only the platform send combo
 * submits, a bare Enter always inserts a newline). The Shift-Escape "jump to
 * Session" shortcut lives in RootOverlay.tsx instead, as a global listener —
 * unlike entering Normal mode, which inherently needs this textarea focused
 * (it means "vim-edit THIS text field"), jumping to Session has no such
 * requirement, and scoping it to this element's own keydown listener meant
 * it silently did nothing whenever focus had drifted elsewhere (confirmed
 * against a real running dsh instance). Installed as one capture-phase
 * native keydown listener — InputBar's own bubble-phase React handler never
 * sees a key this adapter decides to own; every other key (plain typing,
 * IME composition) is left completely alone.
 */
import { matchesKeyCombo, parseKeyCombo } from '../../key-combo.js'
import type { KeyCombo } from '../../key-combo.js'
import { DEFAULT_VIM_KEYMAP_SETTINGS } from '../../settings.js'
import type { ModeMachine } from '../../mode-machine.js'
import type { VimEngine } from '../../bridge/contract.js'

/** Live Insert -> Normal shortcut, re-read every keystroke via a mutable ref so a settings-card edit takes effect without recreating the adapter (mirrors RootOverlay.tsx's `indexRef` pattern). */
export interface KeymapRef {
  current: { enterNormal: KeyCombo }
}

// Non-null: DEFAULT_VIM_KEYMAP_SETTINGS's own combo string is a known-good constant.
const DEFAULT_KEYMAP: KeymapRef['current'] = {
  enterNormal: parseKeyCombo(DEFAULT_VIM_KEYMAP_SETTINGS.enterNormal) as KeyCombo,
}

function isMacPlatform(): boolean {
  return typeof navigator === 'object' && /mac/i.test(navigator.platform || navigator.userAgent || '')
}

/**
 * The host's agreed "send" gesture: Cmd+Enter on Mac, Alt+Enter elsewhere
 * (checked live, not cached, so a test can stub `navigator` per case).
 * Cmd+Enter never actually reaches this check — the unconditional
 * `e.metaKey` bypass in {@link attachTextareaAdapter}'s `onKeyDown` already
 * lets it through before any mode logic runs — but it's still correct to
 * name here for clarity.
 */
function isSendCombo(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && (isMacPlatform() ? e.metaKey : e.altKey)
}

/**
 * The one write path this adapter needs off the framework session kit's
 * `inputActions` (the real type, `InputActions` from
 * `@deepseek-ai/dsh-client-ui-conversation`, is not part of that package's
 * public export surface — this minimal structural type is satisfied by it
 * without naming it, which also keeps this adapter from depending on any
 * more of that face than it actually calls).
 */
export interface DraftWriter {
  setDraft(text: string): void
}

/** Locate the one composer textarea InputBar renders (see InputBar.tsx `data-composer-card`). */
export function findComposerTextarea(root: Document | HTMLElement = document): HTMLTextAreaElement | null {
  return root.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea')
}

export interface TextareaAdapterOptions {
  readonly textarea: HTMLTextAreaElement
  readonly engine: VimEngine
  readonly inputActions: DraftWriter
  readonly mode: ModeMachine
  /** Insert -> Normal shortcut, live-editable via the settings card; defaults to the stock Escape combo when omitted (every existing caller). */
  readonly keymap?: KeymapRef
}

/** Live handle returned by {@link attachTextareaAdapter}. */
export interface TextareaAdapter {
  /** Remove the keydown listener and release engine subscriptions (does not destroy the engine). */
  dispose(): void
}

export function attachTextareaAdapter(options: TextareaAdapterOptions): TextareaAdapter {
  const { textarea, engine, inputActions, mode, keymap } = options

  const restoreCaret = (start: number, end: number): void => {
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start, end)
    })
  }

  const unsubscribeChange = engine.onChange(({ text, sel }) => {
    inputActions.setDraft(text)
    restoreCaret(sel.start, sel.end)
  })

  const unsubscribeMode = engine.onModeChange((engineMode) => {
    if (engineMode === 'insert') mode.enterInsert()
  })

  const insertNewlineAtCaret = (): void => {
    const start = textarea.selectionStart ?? textarea.value.length
    const end = textarea.selectionEnd ?? start
    const next = `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`
    inputActions.setDraft(next)
    restoreCaret(start + 1, start + 1)
  }

  const enterNormalFromHost = (): void => {
    engine.syncFromHost(textarea.value, {
      start: textarea.selectionStart ?? 0,
      end: textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      direction: textarea.selectionDirection === 'backward' ? 'backward' : 'forward',
    })
    mode.enterNormal()
    // syncFromHost clamps a caret sitting past the last character of a line
    // (the common case right after typing) back onto that character —
    // see engine.ts's clampToNormalModeCaret. That clamp only updates the
    // engine's own internal state, though; nothing reads it back onto the
    // visible host textarea automatically the way every later
    // onChange-driven edit does (confirmed against a real running dsh
    // instance: without this readback, the caret stayed stranded one
    // character past the end and every rightward motion looked like it
    // could never reach it).
    const corrected = engine.currentSelection()
    restoreCaret(corrected.start, corrected.end)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    // Meta (Cmd on Mac) is never a vim modifier — real vim in a terminal never
    // even sees it (the terminal/OS owns it). Bypassing it here, in every
    // mode, is what keeps Cmd+C/Cmd+V/Cmd+A and InputBar's own Cmd+Enter send
    // shortcut working while Normal mode is active; without this, the
    // unconditional preventDefault below swallowed all of them.
    if (e.metaKey) return
    // A CJK/IME composition in progress owns Escape itself (cancels the
    // composition) and every other key (candidate selection) — stealing it
    // here would break composing Chinese/Japanese/Korean text in Insert mode,
    // the one case this adapter must never touch.
    if (e.isComposing) return
    const current = mode.current.mode
    const { enterNormal } = keymap?.current ?? DEFAULT_KEYMAP
    if (current === 'insert') {
      if (matchesKeyCombo(e, enterNormal)) {
        e.preventDefault()
        e.stopPropagation()
        enterNormalFromHost()
        return
      }
      if (e.key === 'Enter' && !isSendCombo(e)) {
        // The host's own bubble-phase handler treats a bare Enter as "send"
        // by default; the agreed convention here is the opposite (see
        // README's Modes diagram): Enter always inserts a newline, and only
        // the platform send combo submits. preventDefault() here, then
        // insert the newline ourselves through the one public draft-write
        // path — confirmed against a real running dsh instance that
        // stopPropagation() alone is not enough to let the browser's own
        // native newline-insertion default run: something upstream of this
        // listener already calls preventDefault() on a bare Enter (this
        // plugin never controls when), so relying on that default silently
        // did nothing.
        e.preventDefault()
        e.stopPropagation()
        insertNewlineAtCaret()
        return
      }
      return // every other Insert-mode key (typing, the send combo, ...) passes through to InputBar untouched
    }
    if (current === 'normal') {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === ':') {
        // The vim engine's own ':' (its ex command line) is never visible —
        // it lives on the headless, never-mounted shadow EditorView. This
        // plugin's actual Command palette is what must open instead; blur
        // for the same IME-safety reason RootOverlay.tsx's Shift-Escape
        // handler does, even though the palette's own autoFocus would
        // eventually steal focus anyway — this closes the brief window
        // before it mounts.
        textarea.blur()
        mode.enterCommand('normal')
        return
      }
      engine.dispatchKey(e)
    }
    // Session/Command mode: this textarea is not the active surface; do nothing.
  }
  textarea.addEventListener('keydown', onKeyDown, { capture: true })

  return {
    dispose(): void {
      textarea.removeEventListener('keydown', onKeyDown, { capture: true })
      unsubscribeChange()
      unsubscribeMode()
    },
  }
}
