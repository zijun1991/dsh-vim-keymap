/**
 * Unit coverage for the pure DOM logic RootOverlay's Session-mode keydown
 * handler drives: row classification and the click-dispatch that stands in
 * for both fold-toggle and activation (see tree-bridge.ts — both actions are
 * literally the same click, which is why RootOverlay chooses which to call
 * by `row.kind`, not by any difference in what the bridge does).
 */
import { describe, expect, it } from 'vitest'
import { createWorkspaceTreeBridge } from '../src/client/workspace/tree-bridge.ts'

function buildTree(): HTMLElement {
  const root = document.createElement('div')
  root.setAttribute('role', 'tree')
  root.innerHTML = `
    <div role="treeitem" aria-expanded="true">Workspace A</div>
    <div role="treeitem">Session A1</div>
    <button role="treeitem">search result X</button>
    <div role="treeitem" aria-expanded="false">Workspace B</div>
  `
  document.body.appendChild(root)
  return root
}

describe('createWorkspaceTreeBridge', () => {
  it('classifies rows by tag and aria-expanded presence', () => {
    const root = buildTree()
    const bridge = createWorkspaceTreeBridge({ root })
    const rows = bridge.rows()

    expect(rows.map(r => r.kind)).toEqual(['group', 'session', 'search-result', 'group'])
    expect(rows.map(r => r.expanded)).toEqual([true, null, null, false])

    root.remove()
  })

  it('toggleFold and activate both dispatch a real click on the row element', () => {
    const root = buildTree()
    const bridge = createWorkspaceTreeBridge({ root })
    const rows = bridge.rows()
    const groupRow = rows[0]
    if (groupRow === undefined) throw new Error('unreachable')

    let clicks = 0
    groupRow.element.addEventListener('click', () => { clicks += 1 })

    bridge.toggleFold(groupRow)
    expect(clicks).toBe(1)

    bridge.activate(groupRow)
    expect(clicks).toBe(2)

    root.remove()
  })

  it('toggleFold is a no-op for a row with no fold state (session/search-result)', () => {
    const root = buildTree()
    const bridge = createWorkspaceTreeBridge({ root })
    const sessionRow = bridge.rows()[1]
    if (sessionRow === undefined) throw new Error('unreachable')

    let clicks = 0
    sessionRow.element.addEventListener('click', () => { clicks += 1 })

    bridge.toggleFold(sessionRow)
    expect(clicks).toBe(0)

    root.remove()
  })

  it('focusSearch returns false when no search input is on screen', () => {
    const root = buildTree()
    const bridge = createWorkspaceTreeBridge({ root })
    expect(bridge.focusSearch()).toBe(false)
    root.remove()
  })

  it('focusSearch clicks the collapsed search toggle, then focuses the input (confirmed against a real dsh instance: a bare .focus() alone does not expand it)', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="hashedSearchWrapper">
        <button class="hashedSearchButton" aria-label="搜索会话" aria-expanded="false"></button>
        <input type="text" class="hashedSearchInput">
      </div>
    `
    const root = buildTree()
    container.appendChild(root)
    document.body.appendChild(container)

    const toggle = container.querySelector('button')
    if (toggle === null) throw new Error('unreachable')
    let toggleClicks = 0
    toggle.addEventListener('click', () => { toggleClicks += 1 })

    const bridge = createWorkspaceTreeBridge({ root: container })
    expect(bridge.focusSearch()).toBe(true)
    expect(toggleClicks).toBe(1)
    expect(document.activeElement).toBe(container.querySelector('input'))

    container.remove()
  })

  it('focusSearch does not re-click an already-expanded search toggle', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="hashedSearchWrapper">
        <button class="hashedSearchButton" aria-label="搜索会话" aria-expanded="true"></button>
        <input type="text" class="hashedSearchInput">
      </div>
    `
    const root = buildTree()
    container.appendChild(root)
    document.body.appendChild(container)

    const toggle = container.querySelector('button')
    if (toggle === null) throw new Error('unreachable')
    let toggleClicks = 0
    toggle.addEventListener('click', () => { toggleClicks += 1 })

    const bridge = createWorkspaceTreeBridge({ root: container })
    expect(bridge.focusSearch()).toBe(true)
    expect(toggleClicks).toBe(0)
    expect(document.activeElement).toBe(container.querySelector('input'))

    container.remove()
  })

  it('focusSearch skips a text input inside an open dialog (e.g. the rename-workspace dialog)', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div role="dialog" aria-label="Rename workspace">
        <input type="text" value="my-workspace">
      </div>
    `
    const root = buildTree()
    container.appendChild(root)
    document.body.appendChild(container)

    const bridge = createWorkspaceTreeBridge({ root: container })
    expect(bridge.focusSearch()).toBe(false) // the only text input on screen is inside the dialog

    container.remove()
  })
})
