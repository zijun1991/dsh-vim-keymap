/**
 * Dev-harness bootstrap. Imports the real built `lib/` output — the same
 * artifact a consumer would load — and wires it to the mock DOM in
 * index.html. The only harness-only logic here is the fold/expand mock,
 * which mirrors `ui-workspace`'s documented semantics (a folded group's
 * session rows are entirely absent from the DOM) well enough to exercise
 * `tree-bridge.ts` for real.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ModeMachine } from '../lib/mode-machine.js'
import { CodeMirrorVimEngine } from '../lib/client/normal/engine.js'
import { attachTextareaAdapter } from '../lib/client/normal/textarea-adapter.js'
import { createRootOverlay } from '../lib/client/overlay/RootOverlay.js'
import { LocalKeymapSettingsStore } from '../lib/client/settings/local-store.js'
import { createVimKeymapSettingsCard } from '../lib/client/settings/VimKeymapSettingsCard.js'
import { en } from '../lib/client/settings/locales.js'

// The settings card persists to real `localStorage` — this IS a real
// browser, so no mock is needed here (unlike the old Host-`SettingsScope`
// design this replaced, which needed a fake to stand in for a running dsh).
const settings = new LocalKeymapSettingsStore()
// The real `t` prop is framework-injected via `locale:` at slot registration
// (see client/index.ts) — no such framework exists here, so the harness
// just reads the English dictionary directly.
const t = (key: keyof typeof en): string => en[key]

const mode = new ModeMachine()
const badge = document.getElementById('mode-badge')
if (badge === null) throw new Error('dev-harness: #mode-badge missing')
mode.onChange((s) => {
  badge.textContent = `mode: ${s.mode}${s.commandFlavor !== null ? ` (${s.commandFlavor})` : ''}`
})

const textarea = document.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea')
if (textarea === null) throw new Error('dev-harness: composer textarea missing')

const engine = new CodeMirrorVimEngine()
const adapter = attachTextareaAdapter({
  textarea,
  engine,
  mode,
  inputActions: {
    setDraft(text) {
      textarea.value = text
      ;(window as unknown as { __lastDraft: string }).__lastDraft = text
    },
  },
})

// ── harness-only: mock ui-workspace's fold/expand DOM semantics ────────────
const treeEl = document.getElementById('tree')
if (treeEl === null) throw new Error('dev-harness: #tree missing')
const tree: HTMLElement = treeEl
const activatedLog = document.getElementById('activated-log')
if (activatedLog === null) throw new Error('dev-harness: #activated-log missing')

const GROUP_CHILDREN: Record<string, string[]> = {
  a: ['Session A1', 'Session A2'],
  b: ['Session B1', 'Session B2'],
}

function setExpanded(row: HTMLElement, expanded: boolean): void {
  const group = row.dataset.group
  if (group === undefined) return
  row.setAttribute('aria-expanded', String(expanded))
  tree.querySelectorAll<HTMLElement>(`.row.session[data-group="${group}"]`).forEach((el) => { el.remove() })
  if (!expanded) return
  let after: Element = row
  for (const label of GROUP_CHILDREN[group] ?? []) {
    const div = document.createElement('div')
    div.setAttribute('role', 'treeitem')
    div.className = 'row session'
    div.dataset.group = group
    div.tabIndex = -1
    div.textContent = `  ${label}`
    after.after(div)
    after = div
  }
}

tree.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]').forEach((row) => {
  setExpanded(row, row.getAttribute('aria-expanded') === 'true')
})

tree.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.dataset.action === 'menu') return // ProjectRowItem's own menu button stops propagation in production; mirrored here
  const row = target.closest<HTMLElement>('[role="treeitem"]')
  if (row === null) return
  if (row.hasAttribute('aria-expanded')) {
    setExpanded(row, row.getAttribute('aria-expanded') !== 'true')
    return
  }
  activatedLog.textContent = `activated: ${row.textContent?.trim() ?? ''}`
})

// ── mount the real RootOverlay (Session highlight + Command palette) ──────
const mount = document.getElementById('overlay-mount')
if (mount === null) throw new Error('dev-harness: #overlay-mount missing')
const RootOverlay = createRootOverlay(mode, settings)
createRoot(mount).render(createElement(RootOverlay))

// ── mount the real settings.plugin.item card against the same store ───────
const settingsMount = document.getElementById('settings-mount')
if (settingsMount === null) throw new Error('dev-harness: #settings-mount missing')
const VimKeymapSettingsCard = createVimKeymapSettingsCard(settings)
createRoot(settingsMount).render(createElement(VimKeymapSettingsCard, { t }))

// exposed for browser-driven manual poking
Object.assign(window, { __mode: mode, __adapter: adapter, __engine: engine, __settings: settings })
