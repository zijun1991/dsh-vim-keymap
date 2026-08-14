/**
 * Bridges a {@link VimEngine} to the real, unmodified composer `<textarea>`,
 * and owns every mode-entry key that fires while that textarea has focus
 * (Esc -> Normal, Shift+Esc -> Session). Installed as one capture-phase
 * native keydown listener — InputBar's own bubble-phase React handler never
 * sees a key this adapter decides to own; every other key (plain typing, the
 * send shortcut, IME composition) is left completely alone.
 */
import type { ModeMachine } from '../../mode-machine.js'
import type { VimEngine } from '../../bridge/contract.js'

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
}

/** Live handle returned by {@link attachTextareaAdapter}. */
export interface TextareaAdapter {
  /** Remove the keydown listener and release engine subscriptions (does not destroy the engine). */
  dispose(): void
}

export function attachTextareaAdapter(options: TextareaAdapterOptions): TextareaAdapter {
  const { textarea, engine, inputActions, mode } = options

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

  const enterNormalFromHost = (): void => {
    engine.syncFromHost(textarea.value, {
      start: textarea.selectionStart ?? 0,
      end: textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      direction: textarea.selectionDirection === 'backward' ? 'backward' : 'forward',
    })
    mode.enterNormal()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const current = mode.current.mode
    if (current === 'insert') {
      if (e.key === 'Escape' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        enterNormalFromHost()
        return
      }
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        mode.enterSession()
        return
      }
      return // every other Insert-mode key passes through to InputBar untouched
    }
    if (current === 'normal') {
      e.preventDefault()
      e.stopPropagation()
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
