/** Node-side entry: this plugin is browser-only, so there is nothing to apply here (see client/index.ts). */
import type { Context } from '@deepseek-ai/cordis'

export const inject: string[] = []

export function apply(_ctx: Context): void {
  // Intentionally empty — dsh-vim-keymap has no Node-side behavior.
}
