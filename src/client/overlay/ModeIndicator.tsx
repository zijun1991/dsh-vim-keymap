/**
 * Always-portal-mounted mode badge — the one visual cue the user has for
 * which of the four modes is live (nothing else in the host UI shows it:
 * there is no real cursor-shape/statusline convention to piggyback on).
 * Display policy is `KeymapConfig.modeIndicator`: 'persistent' (always
 * shown), 'on-change' (shown for {@link ON_CHANGE_VISIBLE_MS} after a
 * transition, then hidden), or 'hidden'. Not yet wired to `ctx.settings`
 * (see README.md "Known limitations" — same deferred-settings status as the
 * shortcut config it lives beside).
 */
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import type { ModeMachine, ModeState } from '../../mode-machine.js'
import type { ModeIndicatorDisplay } from '../../config.js'

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
  readonly display: ModeIndicatorDisplay
}

export function ModeIndicator({ mode, display }: ModeIndicatorProps): React.JSX.Element | null {
  const [state, setState] = useState(mode.current)
  // 'persistent' starts (and stays) visible; 'on-change' starts hidden until
  // the first real transition; 'hidden' never reads this at all (early return below).
  const [visible, setVisible] = useState(display === 'persistent')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
