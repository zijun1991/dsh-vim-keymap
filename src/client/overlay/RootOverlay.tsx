/**
 * Registered into `shell.overlay` (the additive, click-through-until-opted-in
 * global overlay slot ui-layout documents — never into `root`, which is
 * AppFrame's exclusive seat). Owns Session-mode's tree navigation and hosts
 * the Command palette; renders nothing while in Insert/Normal.
 *
 * `mode` arrives by closure (see createNormalModeSlot.ts for why): `shell.overlay`
 * declares no owner share either.
 */
import { useEffect, useRef, useState } from 'react'
import type { ModeMachine } from '../../mode-machine.js'
import type { TreeRow } from '../../bridge/contract.js'
import { createWorkspaceTreeBridge } from '../workspace/tree-bridge.js'
import { findComposerTextarea } from '../normal/textarea-adapter.js'
import { HighlightOverlay } from './HighlightOverlay.js'
import { CommandPalette } from './CommandPalette.js'

/** @returns a component to register into `shell.overlay`. */
export function createRootOverlay(mode: ModeMachine): () => React.JSX.Element | null {
  return function RootOverlay(): React.JSX.Element | null {
    const [state, setState] = useState(mode.current)
    const [rows, setRows] = useState<readonly TreeRow[]>([])
    const [index, setIndex] = useState(0)
    // The keydown closure below reads the live index through this ref (not
    // the `index` dependency) so the listener installs once per Session
    // entry instead of being torn down and reattached on every keystroke.
    const indexRef = useRef(0)

    useEffect(() => mode.onChange(setState), [])

    // Session-mode keydown handling: document-level, active only while the
    // Session state is current. Does not move real browser focus — the
    // highlight is our own concept, layered over the host's rendered rows.
    useEffect(() => {
      if (state.mode !== 'session') return undefined

      const bridge = createWorkspaceTreeBridge()
      indexRef.current = 0
      setRows(bridge.rows())
      setIndex(0)

      const setHighlight = (rows2: readonly TreeRow[], i: number): void => {
        indexRef.current = i
        setRows(rows2)
        setIndex(i)
      }

      // After a fold/activate the DOM can grow or shrink (collapsing a group
      // removes its session rows entirely — see tree-bridge.ts). Re-reading
      // and re-clamping keeps the highlight from pointing at a stale index.
      const refreshAfterMutation = (): void => {
        const current = bridge.rows()
        setHighlight(current, Math.min(indexRef.current, Math.max(0, current.length - 1)))
      }

      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.metaKey) return // Cmd is OS chrome, never a Session-mode key
        const current = bridge.rows()
        if (current.length === 0) return
        if (e.key === 'j') {
          e.preventDefault()
          setHighlight(current, Math.min(indexRef.current + 1, current.length - 1))
        } else if (e.key === 'k') {
          e.preventDefault()
          setHighlight(current, Math.max(indexRef.current - 1, 0))
        } else if (e.key === 'h' || e.key === 'l') {
          e.preventDefault()
          const row = current[indexRef.current]
          if (row !== undefined) bridge.toggleFold(row)
          refreshAfterMutation()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const row = current[indexRef.current]
          if (row !== undefined) bridge.activate(row)
          refreshAfterMutation()
        } else if (e.key === '/') {
          e.preventDefault()
          bridge.focusSearch()
        } else if (e.key === ':') {
          e.preventDefault()
          mode.enterCommand('session')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          mode.enterInsert()
          findComposerTextarea()?.focus()
        }
      }
      document.addEventListener('keydown', onKeyDown, { capture: true })
      return () => { document.removeEventListener('keydown', onKeyDown, { capture: true }) }
    }, [state.mode])

    if (state.mode === 'command') {
      return (
        <CommandPalette
          flavor={state.commandFlavor ?? 'session'}
          // No command vocabulary exists yet (see README "Known limitations")
          // — this is the palette shell only; submitting just closes it.
          onSubmit={() => { mode.exitCommand() }}
          onCancel={() => { mode.exitCommand() }}
        />
      )
    }

    if (state.mode !== 'session') return null
    return <HighlightOverlay target={rows[index]?.element ?? null} />
  }
}
