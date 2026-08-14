/**
 * i18n copy for the settings card only (`settings.plugin.item`) — it sits
 * among the Host's own bilingual cards ("终端"/"Agent 循环"/"网页搜索"), so it
 * follows the same `ctx.locale` mechanism they do. The rest of this plugin's
 * UI (the mode badge, the Command palette) is simple, self-contained, and
 * stays hardcoded English by deliberate choice — not every surface needs
 * this machinery.
 */

/** Locale namespace this card owns (distinct from the localStorage key in local-store.ts). */
export const VIM_KEYMAP_SETTINGS_LOCALE_NS = 'dsh-vim-keymap.settings'

/** Translation keys this card's copy uses. */
export type VimKeymapSettingsLocaleKey =
  | 'title' | 'description' | 'expand' | 'collapse'
  | 'modeIndicatorLabel' | 'persistent' | 'onChange' | 'hidden' | 'localOnly'
  | 'enterNormalLabel' | 'enterSessionLabel' | 'shortcutHint' | 'invalidShortcut'

/** Simplified Chinese copy. */
export const zh: Record<VimKeymapSettingsLocaleKey, string> = {
  title: 'Vim 键位',
  description: '为输入框和会话树提供 vim 风格的键位绑定。',
  expand: '展开',
  collapse: '收起',
  modeIndicatorLabel: '模式提示徽标',
  persistent: '常驻显示',
  onChange: '仅切换时显示',
  hidden: '不显示',
  localOnly: '仅保存在此浏览器，不随账号同步。',
  enterNormalLabel: '进入 Normal 模式',
  enterSessionLabel: '进入 Session 模式',
  shortcutHint: '例如 Escape、Shift+Escape',
  invalidShortcut: '无法识别的按键组合，未保存。',
}

/** English copy. */
export const en: Record<VimKeymapSettingsLocaleKey, string> = {
  title: 'Vim Keymap',
  description: 'Vim-style keybindings for the composer and session tree.',
  expand: 'Expand',
  collapse: 'Collapse',
  modeIndicatorLabel: 'Mode badge',
  persistent: 'Persistent',
  onChange: 'On mode change',
  hidden: 'Hidden',
  localOnly: 'Saved in this browser only, not synced with your account.',
  enterNormalLabel: 'Enter Normal mode',
  enterSessionLabel: 'Enter Session mode',
  shortcutHint: 'e.g. Escape, Shift+Escape',
  invalidShortcut: 'Unrecognized key combo, not saved.',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Vim-keymap settings card copy. */
    'dsh-vim-keymap.settings': VimKeymapSettingsLocaleKey
  }
}
