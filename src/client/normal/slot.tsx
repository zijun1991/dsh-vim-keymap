/**
 * Registers into `conversation.session.header.actions` — a `list`-kind,
 * additive slot meant for per-session header buttons — but renders nothing.
 * This is the only way to reach the same `useInput`/`inputActions` InputBar
 * itself reads, without registering into (or otherwise touching)
 * `conversation.composer.bar`, which InputBar already occupies exclusively.
 * See README.md for why this is the chosen seam.
 *
 * `mode` is a plugin-level singleton closed over here rather than passed as
 * an owner prop — `conversation.session.header.actions` declares no owner
 * share (everything comes from the framework session kit), so the shared
 * ModeMachine has to arrive by closure, not by prop.
 */
import { useEffect, useRef } from 'react'
import type { ModeMachine } from '../../mode-machine.js'
import { CodeMirrorVimEngine } from './engine.js'
import { attachTextareaAdapter, findComposerTextarea } from './textarea-adapter.js'

export interface NormalModeSlotProps {
  useInput: (selector: (s: { draft: string }) => string) => string
  inputActions: { setDraft(text: string): void }
}

/** @returns a component to register into `conversation.session.header.actions`; renders nothing. */
export function createNormalModeSlot(mode: ModeMachine): (props: NormalModeSlotProps) => null {
  return function NormalModeSlot({ inputActions }: NormalModeSlotProps): null {
    const inputActionsRef = useRef(inputActions)
    inputActionsRef.current = inputActions

    useEffect(() => {
      const textarea = findComposerTextarea()
      if (textarea === null) return undefined // the composer is not on screen yet; no bridge to attach

      const engine = new CodeMirrorVimEngine()
      const adapter = attachTextareaAdapter({
        textarea,
        engine,
        mode,
        inputActions: { setDraft: (text) => { inputActionsRef.current.setDraft(text) } },
      })
      return () => {
        adapter.dispose()
        engine.destroy()
      }
    }, [])

    return null
  }
}
