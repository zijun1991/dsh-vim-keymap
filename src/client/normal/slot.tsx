/**
 * Registers into `conversation.session.header.actions` — a `list`-kind,
 * additive slot meant for per-session header buttons — but renders nothing.
 * This is the only way to reach the same `useInput`/`inputActions` InputBar
 * itself reads, without registering into (or otherwise touching)
 * `conversation.composer.bar`, which InputBar already occupies exclusively.
 * See README.md for why this is the chosen seam.
 *
 * `mode` is a plugin-level singleton closed over here rather than passed as
 * an owner prop — `conversation.session.header.actions` declares no owner
 * share (everything comes from the framework session kit), so the shared
 * ModeMachine has to arrive by closure, not by prop. `settings` arrives the
 * same way, and its `enterNormal`/`enterSession` fields feed the adapter
 * through a ref (see `KeymapRef` in textarea-adapter.ts) rather than a
 * mount-effect dependency, so a settings-card edit takes effect without
 * tearing down and recreating the (stateful) vim engine.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ModeMachine } from '../../mode-machine.js'
import { parseKeyCombo } from '../../key-combo.js'
import type { KeyCombo } from '../../key-combo.js'
import { DEFAULT_VIM_KEYMAP_SETTINGS } from '../../settings.js'
import type { LocalKeymapSettingsStore } from '../settings/local-store.js'
import { CodeMirrorVimEngine } from './engine.js'
import { attachTextareaAdapter, findComposerTextarea } from './textarea-adapter.js'

export interface NormalModeSlotProps {
  useInput: (selector: (s: { draft: string }) => string) => string
  inputActions: { setDraft(text: string): void }
}

// Non-null: DEFAULT_VIM_KEYMAP_SETTINGS's own combo strings are known-good constants.
const FALLBACK_ENTER_NORMAL = parseKeyCombo(DEFAULT_VIM_KEYMAP_SETTINGS.enterNormal) as KeyCombo
const FALLBACK_ENTER_SESSION = parseKeyCombo(DEFAULT_VIM_KEYMAP_SETTINGS.enterSession) as KeyCombo

/**
 * @param settings - the local-storage-backed settings store, read for the
 * live `enterNormal`/`enterSession` shortcuts (see module docs above).
 * @returns a component to register into `conversation.session.header.actions`; renders nothing.
 */
export function createNormalModeSlot(
  mode: ModeMachine,
  settings: LocalKeymapSettingsStore,
): (props: NormalModeSlotProps) => null {
  return function NormalModeSlot({ inputActions }: NormalModeSlotProps): null {
    const inputActionsRef = useRef(inputActions)
    inputActionsRef.current = inputActions

    const snapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
    const keymapRef = useRef({ enterNormal: FALLBACK_ENTER_NORMAL, enterSession: FALLBACK_ENTER_SESSION })
    keymapRef.current = {
      enterNormal: parseKeyCombo(snapshot.enterNormal) ?? FALLBACK_ENTER_NORMAL,
      enterSession: parseKeyCombo(snapshot.enterSession) ?? FALLBACK_ENTER_SESSION,
    }

    useEffect(() => {
      const textarea = findComposerTextarea()
      if (textarea === null) return undefined // the composer is not on screen yet; no bridge to attach

      const engine = new CodeMirrorVimEngine()
      const adapter = attachTextareaAdapter({
        textarea,
        engine,
        mode,
        inputActions: { setDraft: (text) => { inputActionsRef.current.setDraft(text) } },
        keymap: keymapRef,
      })
      return () => {
        adapter.dispose()
        engine.destroy()
      }
    }, [])

    return null
  }
}
