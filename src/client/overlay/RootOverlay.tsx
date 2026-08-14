/**
 * Registered into `shell.overlay` (the additive, click-through-until-opted-in
 * global overlay slot ui-layout documents — never into `root`, which is
 * AppFrame's exclusive seat). Owns Session-mode's tree navigation and hosts
 * the Command palette; renders nothing while in Insert/Normal.
 *
 * `mode` arrives by closure (see createNormalModeSlot.ts for why): `shell.overlay`
 * declares no owner share either.
 */
import { useEffect, useState } from 'react'
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

    useEffect(() => mode.onChange(setState), [])

    // Session-mode keydown handling: document-level, active only while the
    // Session state is current. Does not move real browser focus — the
    // highlight is our own concept, layered over the host's rendered rows.
    useEffect(() => {
      if (state.mode !== 'session') return undefined

      const bridge = createWorkspaceTreeBridge()
      setRows(bridge.rows())
      setIndex(0)

      const onKeyDown = (e: KeyboardEvent): void => {
        const current = bridge.rows()
        if (current.length === 0) return
        if (e.key === 'j') {
          e.preventDefault()
          setRows(current)
          setIndex((i) => Math.min(i + 1, current.length - 1))
        } else if (e.key === 'k') {
          e.preventDefault()
          setRows(current)
          setIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'h' || e.key === 'l') {
          e.preventDefault()
          const row = current[index]
          if (row !== undefined) bridge.toggleFold(row)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const row = current[index]
          if (row !== undefined) bridge.activate(row)
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
    }, [state.mode, index])

    if (state.mode === 'command') {
      return (
        <CommandPalette
          flavor={state.commandFlavor ?? 'session'}
          onSubmit={() => { mode.exitCommand() }}
          onCancel={() => { mode.exitCommand() }}
        />
      )
    }

    if (state.mode !== 'session') return null
    return <HighlightOverlay target={rows[index]?.element ?? null} />
  }
}
