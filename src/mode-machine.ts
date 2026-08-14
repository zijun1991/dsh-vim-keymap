/** Pure mode state machine: no DOM, no React, no Cordis — a single source of truth for the plugin's four states. */

export type Mode = 'insert' | 'normal' | 'session' | 'command'
export type CommandFlavor = 'normal' | 'session'

export interface ModeState {
  readonly mode: Mode
  /** The mode a `command` state should return to on exit; `null` outside `command`. */
  readonly commandFlavor: CommandFlavor | null
}

const INITIAL_STATE: ModeState = { mode: 'insert', commandFlavor: null }

/**
 * Holds the current {@link Mode} and notifies listeners on every transition.
 * Transition methods are no-ops from a state that cannot reach them, so
 * callers do not need to guard the current mode before calling one.
 */
export class ModeMachine {
  private state: ModeState = INITIAL_STATE
  private readonly listeners = new Set<(state: ModeState) => void>()

  get current(): ModeState {
    return this.state
  }

  /** Subscribe to every transition (fires once per actual state change). */
  onChange(fn: (state: ModeState) => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** Insert -> Normal (the standard vim Esc). No-op outside Insert. */
  enterNormal(): void {
    if (this.state.mode === 'insert') this.transition({ mode: 'normal', commandFlavor: null })
  }

  /** Insert -> Session (Shift+Esc by default). No-op outside Insert. */
  enterSession(): void {
    if (this.state.mode === 'insert') this.transition({ mode: 'session', commandFlavor: null })
  }

  /** Normal/Session/Command -> Insert. Idempotent from Insert itself. */
  enterInsert(): void {
    this.transition({ mode: 'insert', commandFlavor: null })
  }

  /** Normal or Session -> Command, remembering which mode to return to. No-op from Insert/Command. */
  enterCommand(flavor: CommandFlavor): void {
    if (this.state.mode === 'normal' || this.state.mode === 'session') {
      this.transition({ mode: 'command', commandFlavor: flavor })
    }
  }

  /** Command -> whichever mode invoked it. No-op outside Command. */
  exitCommand(): void {
    if (this.state.mode !== 'command') return
    this.transition({ mode: this.state.commandFlavor === 'normal' ? 'normal' : 'session', commandFlavor: null })
  }

  private transition(next: ModeState): void {
    if (next.mode === this.state.mode && next.commandFlavor === this.state.commandFlavor) return
    this.state = next
    for (const listener of this.listeners) listener(next)
  }
}
