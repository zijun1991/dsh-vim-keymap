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

  ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-vim-keymap-normal-bridge' },
    createNormalModeSlot(mode),
  )

  ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-vim-keymap-overlay' },
    createRootOverlay(mode),
  )
}
