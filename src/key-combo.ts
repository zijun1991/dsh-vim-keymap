/**
 * Pure key-combo parsing: no DOM, no React — parses strings like
 * `"Shift+Escape"` (the shape already used as a display value in
 * README.md/settings.ts) into a structural form matchable against a live
 * `KeyboardEvent`. Meta (Cmd on Mac) is deliberately not a supported
 * modifier here: `textarea-adapter.ts` unconditionally bypasses every
 * Meta-held keystroke before any combo is even checked (Cmd+C/Cmd+V/Cmd+Enter
 * must reach the browser/host untouched), so a combo requiring Meta could
 * never fire — better to not offer it than to accept a setting that silently
 * does nothing.
 */

export interface KeyCombo {
  /** Matched against `KeyboardEvent.key`, case-insensitively (see {@link matchesKeyCombo}). */
  readonly key: string
  readonly shift: boolean
  readonly ctrl: boolean
  readonly alt: boolean
}

const MODIFIER_ALIASES: Record<string, 'shift' | 'ctrl' | 'alt'> = {
  shift: 'shift',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
}

/** Parses a combo string (e.g. `"Shift+Escape"`, `"Escape"`); `null` if empty, unparseable, or has more than one non-modifier token. */
export function parseKeyCombo(input: string): KeyCombo | null {
  const parts = input.split('+').map(p => p.trim()).filter(p => p.length > 0)
  if (parts.length === 0) return null

  let key: string | null = null
  let shift = false
  let ctrl = false
  let alt = false

  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (modifier !== undefined) {
      if (modifier === 'shift') shift = true
      else if (modifier === 'ctrl') ctrl = true
      else alt = true
      continue
    }
    if (key !== null) return null // a second non-modifier token makes this ambiguous
    key = part
  }

  return key === null ? null : { key, shift, ctrl, alt }
}

/** Whether a live `KeyboardEvent` matches a parsed combo exactly (unset modifiers must also be unheld). */
export function matchesKeyCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  return e.key.toLowerCase() === combo.key.toLowerCase()
    && e.shiftKey === combo.shift
    && e.ctrlKey === combo.ctrl
    && e.altKey === combo.alt
}

/** Canonical display form of a combo (modifier order: Ctrl, Alt, Shift, then the key). */
export function formatKeyCombo(combo: KeyCombo): string {
  const modifiers = [
    combo.ctrl ? 'Ctrl' : null,
    combo.alt ? 'Alt' : null,
    combo.shift ? 'Shift' : null,
  ].filter((m): m is string => m !== null)
  return [...modifiers, combo.key].join('+')
}
