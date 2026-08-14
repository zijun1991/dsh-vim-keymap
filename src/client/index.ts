/**
 * Browser entry: registers the Normal-mode bridge (session-scoped, into
 * `conversation.session.header.actions`) and the Session/Command overlay
 * (root-scoped, into `shell.overlay`). One `ModeMachine` instance is shared
 * between them by closure — see the module docs on each factory for why
 * neither slot can carry it as an owner prop.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls in the SlotMap augmentations these two packages declare
// ('conversation.session.header.actions' + its SessionStandardProps merge,
// and 'shell.overlay') — nothing here is otherwise used by name.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { ModeMachine } from '../mode-machine.js'
import { createNormalModeSlot } from './normal/slot.js'
import { createRootOverlay } from './overlay/RootOverlay.js'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  const mode = new ModeMachine()

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
    createNormalModeSlot(mode),
  ))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-vim-keymap-overlay' },
    createRootOverlay(mode),
  ))
}
