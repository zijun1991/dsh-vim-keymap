/** Pure combo parsing/matching/formatting — no DOM. */
import { describe, expect, it } from 'vitest'
import { formatKeyCombo, matchesKeyCombo, parseKeyCombo } from '../src/key-combo.ts'

describe('parseKeyCombo', () => {
  it('parses a bare key', () => {
    expect(parseKeyCombo('Escape')).toEqual({ key: 'Escape', shift: false, ctrl: false, alt: false })
  })

  it('parses modifiers in any order, case-insensitively', () => {
    expect(parseKeyCombo('Shift+Escape')).toEqual({ key: 'Escape', shift: true, ctrl: false, alt: false })
    expect(parseKeyCombo('ctrl+alt+shift+Escape')).toEqual({ key: 'Escape', shift: true, ctrl: true, alt: true })
    expect(parseKeyCombo('Escape+Shift')).toEqual({ key: 'Escape', shift: true, ctrl: false, alt: false })
  })

  it('accepts control/option as aliases for ctrl/alt', () => {
    expect(parseKeyCombo('Control+Escape')).toEqual({ key: 'Escape', shift: false, ctrl: true, alt: false })
    expect(parseKeyCombo('Option+Escape')).toEqual({ key: 'Escape', shift: false, ctrl: false, alt: true })
  })

  it('rejects empty input and input with no key token', () => {
    expect(parseKeyCombo('')).toBeNull()
    expect(parseKeyCombo('   ')).toBeNull()
    expect(parseKeyCombo('Shift+Ctrl')).toBeNull()
  })

  it('rejects more than one non-modifier token', () => {
    expect(parseKeyCombo('Escape+Enter')).toBeNull()
  })
})

describe('matchesKeyCombo', () => {
  it('matches a live KeyboardEvent exactly, including unset modifiers', () => {
    const combo = parseKeyCombo('Shift+Escape')
    if (combo === null) throw new Error('unreachable')

    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true }), combo)).toBe(true)
    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: false }), combo)).toBe(false)
    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'escape', shiftKey: true }), combo)).toBe(true)
  })

  it('a bare combo does not match if any modifier is held', () => {
    const combo = parseKeyCombo('Escape')
    if (combo === null) throw new Error('unreachable')

    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'Escape' }), combo)).toBe(true)
    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true }), combo)).toBe(false)
    expect(matchesKeyCombo(new KeyboardEvent('keydown', { key: 'Escape', altKey: true }), combo)).toBe(false)
  })
})

describe('formatKeyCombo', () => {
  it('formats in Ctrl, Alt, Shift, key order', () => {
    expect(formatKeyCombo({ key: 'Escape', shift: false, ctrl: false, alt: false })).toBe('Escape')
    expect(formatKeyCombo({ key: 'Escape', shift: true, ctrl: false, alt: false })).toBe('Shift+Escape')
    expect(formatKeyCombo({ key: 'Escape', shift: true, ctrl: true, alt: true })).toBe('Ctrl+Alt+Shift+Escape')
  })
})
