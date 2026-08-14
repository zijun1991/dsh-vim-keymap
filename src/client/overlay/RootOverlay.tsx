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
import type { LocalKeymapSettingsStore } from '../settings/local-store.js'
import { createWorkspaceTreeBridge } from '../workspace/tree-bridge.js'
import { findComposerTextarea } from '../normal/textarea-adapter.js'
import { saveSessionLog } from '../session/session-log-bridge.js'
import { HighlightOverlay } from './HighlightOverlay.js'
import { CommandPalette } from './CommandPalette.js'
import { ModeIndicator } from './ModeIndicator.js'

/**
 * @param mode - the plugin-wide mode singleton.
 * @param settings - the local-storage-backed settings store, threaded down
 * to {@link ModeIndicator} for the live display-policy read.
 * @returns a component to register into `shell.overlay`.
 */
export function createRootOverlay(
  mode: ModeMachine,
  settings: LocalKeymapSettingsStore,
): () => React.JSX.Element | null {
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
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const row = current[indexRef.current]
          if (row === undefined) return
          // A workspace (group) row's Enter is the fold toggle — h/l carry no
          // fold logic of their own. A session/search-result row's Enter is a
          // completed navigation: activate it, then return to Insert exactly
          // like Escape does (composer refocus included).
          if (row.kind === 'group') {
            bridge.toggleFold(row)
            refreshAfterMutation()
          } else {
            bridge.activate(row)
            mode.enterInsert()
            findComposerTextarea()?.focus()
          }
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

    const modeIndicator = <ModeIndicator mode={mode} settings={settings} />

    if (state.mode === 'command') {
      const flavor = state.commandFlavor ?? 'session'
      // Normal mode's "surface" is the composer textarea itself — the
      // palette's autoFocus took focus away from it, and textarea-adapter's
      // keydown listener sits on that exact element, so nothing would route
      // to it again without this (confirmed against a real running dsh
      // instance: cancelling a ':' command left Normal mode keyboard-dead).
      // Session mode needs no equivalent — its keydown handling is
      // document-level, not focus-dependent.
      const exit = (): void => {
        mode.exitCommand()
        if (flavor === 'normal') findComposerTextarea()?.focus()
      }
      const submit = (command: string): void => {
        // The only command in the vocabulary so far (see README "Known
        // limitations" for the rest of the palette shell), and normal-flavor
        // only — it mirrors vim's own `:w`, entered from Normal mode, not
        // Session's tree-navigation vocabulary. A leading "/" is tolerated
        // so both ":save" and ":/save" work, since either reading of a
        // slash-style command is reasonable here.
        if (flavor === 'normal' && command.trim().replace(/^\//, '').toLowerCase() === 'save') {
          saveSessionLog()
        }
        exit()
      }
      return (
        <>
          {modeIndicator}
          <CommandPalette
            flavor={flavor}
            onSubmit={submit}
            onCancel={exit}
          />
        </>
      )
    }

    if (state.mode !== 'session') return modeIndicator
    return (
      <>
        {modeIndicator}
        <HighlightOverlay target={rows[index]?.element ?? null} />
      </>
    )
  }
}
