/** The one global command-input surface, portal-mounted so no host stacking context can occlude it. Two visually distinct "flavors" share this component but never share command lists. */
import { createPortal } from 'react-dom'
import { useState } from 'react'
import type { CommandFlavor } from '../../mode-machine.js'

export interface CommandPaletteProps {
  readonly flavor: CommandFlavor
  readonly onSubmit: (command: string) => void
  readonly onCancel: () => void
}

const FLAVOR_STYLE: Record<CommandFlavor, { label: string; accent: string }> = {
  normal: { label: ':', accent: '#5b8dfc' },
  session: { label: 'Session:', accent: '#e08a3c' },
}

export function CommandPalette({ flavor, onSubmit, onCancel }: CommandPaletteProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const style = FLAVOR_STYLE[flavor]

  return createPortal(
    <div
      style={{
        position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
        zIndex: 2147483001, display: 'flex', alignItems: 'center', gap: 8,
        background: '#1e1e1e', color: '#fff', padding: '6px 12px', borderRadius: 6,
        border: `1px solid ${style.accent}`, fontFamily: 'monospace', minWidth: 320,
      }}
    >
      <span style={{ color: style.accent }}>{style.label}</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => { setValue(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSubmit(value); return }
          if (e.key === 'Escape') { onCancel() }
        }}
        style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
      />
    </div>,
    document.body,
  )
}
