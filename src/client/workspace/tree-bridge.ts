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
 * TODO(follow-up, not yet verified): WorkspaceBrowser.tsx renders at least
 * three `<input type="text">` elements (rename dialog, workspace-path field,
 * and the search box) and none were confirmed to carry a distinguishing
 * `aria-label`/class from source reading alone — a real-browser check is
 * needed to find a selector that reliably picks the search box specifically
 * and not, say, an open rename dialog's input. `focusSearch()` is a stub
 * until then; see README.md "Known limitations".
 */
const SEARCH_INPUT_SELECTOR: string | null = null

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
      if (SEARCH_INPUT_SELECTOR === null) return false
      const input = root.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)
      if (input === null) return false
      input.focus()
      return true
    },
  }
}
