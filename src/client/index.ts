/**
 * Browser entry: registers the Normal-mode bridge (session-scoped, into
 * `conversation.session.header.actions`), the Session/Command overlay
 * (root-scoped, into `shell.overlay`), and this plugin's settings card
 * (root-scoped, into `settings.plugin.item`). One `ModeMachine` instance is
 * shared between the first two by closure — see the module docs on each
 * factory for why neither slot can carry it as an owner prop. The settings
 * store is likewise shared by closure between the Normal-mode bridge and the
 * overlay (which read the mode-entry shortcuts and mode-badge display policy,
 * respectively) and the card (which writes both).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls in the SlotMap augmentations these packages declare
// ('conversation.session.header.actions' + its SessionStandardProps merge,
// 'shell.overlay', and 'settings.plugin.item') — nothing here is otherwise
// used by name.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ModeMachine } from '../mode-machine.js'
import { createNormalModeSlot } from './normal/slot.js'
import { createRootOverlay } from './overlay/RootOverlay.js'
import { LocalKeymapSettingsStore } from './settings/local-store.js'
import { createVimKeymapSettingsCard } from './settings/VimKeymapSettingsCard.js'
import { VIM_KEYMAP_SETTINGS_LOCALE_NS, en, zh } from './settings/locales.js'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  const mode = new ModeMachine()
  const settings = new LocalKeymapSettingsStore()

  // Only the settings card's copy is bilingual — it sits among the Host's own
  // zh/en cards; the mode badge and Command palette stay hardcoded English
  // (see locales.ts).
  ctx.effect(
    () => ctx.locale.register(VIM_KEYMAP_SETTINGS_LOCALE_NS, { zh, en }),
    'dsh-vim-keymap: settings card dictionaries',
  )

  // Both targets are declared by another plugin's own register() call
  // (session-scoped 'conversation.session.header.actions' by a session's
  // header component; root-scoped 'shell.overlay' by ui-layout's AppFrame),
  // not by us — registering directly races that declaration and throws "slot
  // ... is not declared" whenever ours runs first (confirmed against a real
  // running dsh --profile web instance for both slots: the boot graph's
  // per-package `inject` edges are informational metadata for preflight
  // display/HMR diffing, not an activation-order guarantee — see
  // packages/client/modules/src/client/manifest.ts's WebBootEntry.inject
  // doc). ctx.slots.inject() is the documented, race-free pattern (see
  // ui-jobs/ui-subagent/ui-agent-preset's client/index.ts): it waits for the
  // declaration, re-registers on every redeclare, and tears down on collapse.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-vim-keymap-normal-bridge' },
    createNormalModeSlot(mode, settings),
  ))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-vim-keymap-overlay' },
    createRootOverlay(mode, settings),
  ))

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
    { name: 'settings.plugin.item', id: 'dsh-vim-keymap-settings', order: 100, locale: VIM_KEYMAP_SETTINGS_LOCALE_NS },
    createVimKeymapSettingsCard(settings),
  ))
}
