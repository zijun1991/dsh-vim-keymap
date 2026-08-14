/**
 * Node-side entry: this plugin is browser-only, so there is nothing to apply
 * here (see client/index.ts). The mode-badge display policy is persisted in
 * `localStorage` from the browser directly, not through `ctx.settings` — see
 * src/client/settings/local-store.ts for why a real Host settings namespace
 * is a dead end for an out-of-tree plugin.
 */
import type { Context } from '@deepseek-ai/cordis'

export const inject: string[] = []

export function apply(_ctx: Context): void {
  // Intentionally empty — dsh-vim-keymap has no Node-side behavior.
}
