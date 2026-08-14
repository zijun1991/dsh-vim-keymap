import { describe, expect, it } from 'vitest'
import { ModeMachine } from '../src/mode-machine.ts'

describe('ModeMachine', () => {
  it('starts in insert and moves to normal/session only from insert', () => {
    const m = new ModeMachine()
    expect(m.current.mode).toBe('insert')

    m.enterSession()
    expect(m.current.mode).toBe('session')

    m.enterNormal() // no-op: not currently in insert
    expect(m.current.mode).toBe('session')
  })

  it('session Esc goes straight to insert, never through normal', () => {
    const m = new ModeMachine()
    m.enterSession()
    m.enterInsert()
    expect(m.current.mode).toBe('insert')
  })

  it('command mode remembers which mode invoked it and returns there on exit', () => {
    const m = new ModeMachine()
    m.enterNormal()
    m.enterCommand('normal')
    expect(m.current).toEqual({ mode: 'command', commandFlavor: 'normal' })
    m.exitCommand()
    expect(m.current).toEqual({ mode: 'normal', commandFlavor: null })

    m.enterInsert()
    m.enterSession()
    m.enterCommand('session')
    expect(m.current).toEqual({ mode: 'command', commandFlavor: 'session' })
    m.exitCommand()
    expect(m.current).toEqual({ mode: 'session', commandFlavor: null })
  })

  it('enterCommand is a no-op from insert', () => {
    const m = new ModeMachine()
    m.enterCommand('normal')
    expect(m.current.mode).toBe('insert')
  })

  it('notifies listeners exactly once per real transition', () => {
    const m = new ModeMachine()
    const seen: string[] = []
    m.onChange((s) => { seen.push(s.mode) })
    m.enterNormal()
    m.enterNormal() // already normal — must not renotify
    m.enterInsert()
    expect(seen).toEqual(['normal', 'insert'])
  })
})
