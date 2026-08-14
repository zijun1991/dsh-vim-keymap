/**
 * Always-portal-mounted mode badge — the one visual cue the user has for
 * which of the four modes is live (nothing else in the host UI shows it:
 * there is no real cursor-shape/statusline convention to piggyback on).
 * Display policy is read live from `LocalKeymapSettingsStore` (browser
 * `localStorage`, not the Host settings document — see local-store.ts for
 * why): 'persistent' (always shown), 'on-change' (shown for
 * {@link ON_CHANGE_VISIBLE_MS} after a transition, then hidden), or 'hidden'.
 * Editable through the settings card this plugin registers into
 * `settings.plugin.item` (src/client/settings/VimKeymapSettingsCard.tsx).
 */
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ModeMachine, ModeState } from '../../mode-machine.js'
import type { LocalKeymapSettingsStore } from '../settings/local-store.js'

const MODE_LABEL: Record<ModeState['mode'], string> = {
  insert: 'INSERT',
  normal: 'NORMAL',
  session: 'SESSION',
  command: 'COMMAND',
}

const MODE_ACCENT: Record<ModeState['mode'], string> = {
  insert: '#8a8f98',
  normal: '#5b8dfc',
  session: '#e08a3c',
  command: '#c264e0',
}

/** How long an 'on-change' badge stays visible after a transition. */
const ON_CHANGE_VISIBLE_MS = 1200

export interface ModeIndicatorProps {
  readonly mode: ModeMachine
  readonly settings: LocalKeymapSettingsStore
}

export function ModeIndicator({ mode, settings }: ModeIndicatorProps): React.JSX.Element | null {
  const [state, setState] = useState(mode.current)
  const snapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
  const display = snapshot.modeIndicator
  const [visible, setVisible] = useState(display === 'persistent')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The policy itself can change live (the settings card writes it): a
  // switch into 'persistent'/'hidden' takes effect immediately; a switch
  // into 'on-change' starts hidden until the next transition, same as if
  // the plugin had booted with that policy.
  useEffect(() => {
    if (display === 'on-change') { setVisible(false); return }
    setVisible(display === 'persistent')
  }, [display])

  useEffect(() => mode.onChange((next) => {
    setState(next)
    if (display !== 'on-change') return
    setVisible(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { setVisible(false) }, ON_CHANGE_VISIBLE_MS)
  }), [display])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  if (display === 'hidden' || !visible) return null

  const accent = MODE_ACCENT[state.mode]
  return createPortal(
    <div
      aria-hidden
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 2147483002,
        pointerEvents: 'none',
        background: '#1e1e1e',
        color: accent,
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: '0.05em',
        padding: '4px 10px',
        borderRadius: 4,
        border: `1px solid ${accent}`,
      }}
    >
      Vim Mode: {MODE_LABEL[state.mode]}
    </div>,
    document.body,
  )
}
