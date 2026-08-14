/**
 * WorkspaceTreeBridge implementation driven entirely off the rendered,
 * accessible DOM (`role="tree"`/`role="treeitem"`/`aria-expanded`) that
 * `ui-workspace`'s WorkspaceBrowser already renders — see README.md for why
 * this plugin never imports `ui-workspace` internals or its view store.
 * Fold/expand and row activation both work by dispatching a real click,
 * exactly like a mouse user would, because both `ProjectRowItem` and
 * `SessionNodeItem` put their handler directly on the row's own root element.
 */
import type { TreeRow, WorkspaceTreeBridge } from '../../bridge/contract.js'

/**
 * Confirmed against a real running `dsh --profile web` instance:
 * WorkspaceBrowser.tsx renders the session-search `<input type="text">`
 * directly in the sidebar (no distinguishing `aria-label`, and its CSS
 * class is a build-hashed CSS-module name, not a stable selector target),
 * while the *other* `<input type="text">` on screen — the rename-workspace
 * dialog's name field — only exists while that dialog's `role="dialog"`
 * wrapper is mounted. Excluding any input inside a `role="dialog"` ancestor
 * is what reliably tells them apart.
 */
function findSearchInput(root: Document | HTMLElement): HTMLInputElement | null {
  const candidates = root.querySelectorAll<HTMLInputElement>('input[type="text"]')
  for (const input of candidates) {
    if (input.closest('[role="dialog"]') === null) return input
  }
  return null
}

/**
 * The search box starts visually collapsed (zero width, `opacity: 0`,
 * `pointer-events: none`) — confirmed against a real running `dsh --profile
 * web` instance that a bare `.focus()` on it does NOT expand it; only a real
 * click on its sibling toggle button does (which also focuses the input
 * itself as part of that same click). The toggle has no stable class either,
 * but it shares the input's own parent and is the only sibling carrying
 * `aria-expanded` — locale/build-independent, unlike matching on its
 * (Chinese) `aria-label`.
 */
function findSearchToggle(input: HTMLInputElement): HTMLButtonElement | null {
  return input.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded]') ?? null
}

function rowKindOf(el: Element): TreeRow['kind'] {
  if (el.tagName === 'BUTTON') return 'search-result' // SearchResultItem is the only <button role="treeitem">
  return el.hasAttribute('aria-expanded') ? 'group' : 'session'
}

function toTreeRow(el: HTMLElement): TreeRow {
  const expandedAttr = el.getAttribute('aria-expanded')
  return {
    element: el,
    kind: rowKindOf(el),
    expanded: expandedAttr === null ? null : expandedAttr === 'true',
  }
}

export interface CreateWorkspaceTreeBridgeOptions {
  /** The scrollable container that holds every `role="treeitem"` row (defaults to `document`). */
  root?: Document | HTMLElement
}

export function createWorkspaceTreeBridge(options: CreateWorkspaceTreeBridgeOptions = {}): WorkspaceTreeBridge {
  const root = options.root ?? document

  return {
    rows(): readonly TreeRow[] {
      return Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]')).map(toTreeRow)
    },
    toggleFold(row: TreeRow): void {
      if (row.expanded === null) return // session/search rows have nothing to fold
      row.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    },
    activate(row: TreeRow): void {
      row.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    },
    focusSearch(): boolean {
      const input = findSearchInput(root)
      if (input === null) return false
      const toggle = findSearchToggle(input)
      if (toggle !== null && toggle.getAttribute('aria-expanded') !== 'true') {
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
      input.focus()
      return true
    },
  }
}
