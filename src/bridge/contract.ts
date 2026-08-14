/**
 * Bridge-layer contracts. The vim engine and the Session-tree navigator speak
 * only these interfaces; each concrete implementation adapts one host surface
 * (the composer textarea, the workspace tree DOM) without the other side
 * knowing which host it is talking to.
 */

/** One text selection, in plain-string offsets (matches `HTMLTextAreaElement.selectionStart/End`). */
export interface TextSelection {
  readonly start: number
  readonly end: number
  readonly direction?: 'forward' | 'backward'
}

/**
 * A vim text-editing engine: takes host text + selection in, consumes
 * keystrokes, and reports the edited result back out. Implementations never
 * touch the host DOM directly — {@link TextareaHostAdapter} does that.
 */
export interface VimEngine {
  readonly mode: 'insert' | 'normal' | 'visual' | 'visual-line'
  /** Replace the engine's document and selection with the host's current state (called on entering Normal). */
  syncFromHost(text: string, sel: TextSelection): void
  /** Feed one native keydown event to the engine. Returns true if the engine consumed it. */
  dispatchKey(e: KeyboardEvent): boolean
  /** Fires after a keystroke that changed the document or selection. */
  onChange(cb: (next: { text: string; sel: TextSelection }) => void): () => void
  /** Fires when the engine's own mode changes (e.g. `i`/`a`/`o` back to insert). */
  onModeChange(cb: (mode: VimEngine['mode']) => void): () => void
  /** Release engine resources (called once, on host teardown — not on every Normal exit). */
  destroy(): void
}

/** One row in the workspace/session tree, addressed by its live DOM element (no id — see workspace-bridge.ts). */
export interface TreeRow {
  readonly element: HTMLElement
  readonly kind: 'group' | 'session' | 'search-result'
  readonly expanded: boolean | null
}

/**
 * Session-tree navigation surface, driven entirely off the rendered,
 * accessible DOM (`role="tree"`/`role="treeitem"`/`aria-expanded`) — see
 * README.md for why this plugin never imports `ui-workspace` internals.
 */
export interface WorkspaceTreeBridge {
  /** Current visible rows in on-screen order (workspace groups and session rows, not collapsed descendants). */
  rows(): readonly TreeRow[]
  /** Toggle the fold state of a group row by dispatching a real click on it. */
  toggleFold(row: TreeRow): void
  /** Open/select a session row by dispatching a real click on it. */
  activate(row: TreeRow): void
  /** Focus the existing search input, if the host currently renders one. */
  focusSearch(): boolean
}
