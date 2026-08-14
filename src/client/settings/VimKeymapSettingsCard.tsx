/**
 * This plugin's card in Settings -> Plugins -> Plugin Configuration
 * (`settings.plugin.item`, declared by `@deepseek-ai/dsh-client-ui-settings-plugins`).
 * One field — the mode-badge display policy — applies instantly on change;
 * there is no save/discard staging, since a single enum selection needs none
 * of the multi-field editing that staged form exists for. Persists to
 * `localStorage` (see local-store.ts), not the Host settings document — a
 * real Host-backed namespace is a dead end for an out-of-tree plugin (see
 * local-store.ts's module doc for the confirmed root cause).
 *
 * The chrome (chevron header, name/description, expand/collapse) is
 * hand-rolled rather than importing that package's own `PluginCard`: its
 * `./client` entry re-exports only the card TYPES, and the component itself
 * lives under `src/`, which the package's published `files` list excludes —
 * so `PluginCard` is not actually reachable from outside the monorepo
 * (confirmed by reading its package.json, not assumed). Copy is bilingual
 * (see locales.ts) since this card sits among the Host's own zh/en cards;
 * `t` arrives as a framework-injected prop (via `locale:` at registration),
 * not by closure, because only that path re-renders on a live locale switch.
 */
import { useState, useSyncExternalStore } from 'react'
import { MODE_INDICATOR_DISPLAYS } from '../../settings.js'
import type { ModeIndicatorDisplay } from '../../settings.js'
import type { LocalKeymapSettingsStore } from './local-store.js'
import type { VimKeymapSettingsLocaleKey } from './locales.js'

const DISPLAY_LABEL_KEY: Record<ModeIndicatorDisplay, VimKeymapSettingsLocaleKey> = {
  persistent: 'persistent',
  'on-change': 'onChange',
  hidden: 'hidden',
}

export interface VimKeymapSettingsCardProps {
  readonly t: (key: VimKeymapSettingsLocaleKey) => string
}

/**
 * @param settings - the local-storage-backed settings store.
 * @returns a component to register into `settings.plugin.item`.
 */
export function createVimKeymapSettingsCard(
  settings: LocalKeymapSettingsStore,
): (props: VimKeymapSettingsCardProps) => React.JSX.Element {
  return function VimKeymapSettingsCard({ t }: VimKeymapSettingsCardProps): React.JSX.Element {
    const [open, setOpen] = useState(false)
    const snapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
    const display = snapshot.modeIndicator

    return (
      <li style={{ listStyle: 'none', border: '1px solid rgba(128, 128, 128, 0.35)', borderRadius: 12 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
          onClick={() => { setOpen(!open) }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t('title')}</span>
            <span style={{ fontSize: 13, opacity: 0.65 }}>{t('description')}</span>
          </span>
          <span aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .16s' }}>
            {'▾'}
          </span>
        </button>
        {open
          ? (
            <div style={{ borderTop: '1px solid rgba(128, 128, 128, 0.35)', margin: '0 16px', padding: '12px 0' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <span>{t('modeIndicatorLabel')}</span>
                <select
                  value={display}
                  onChange={(e) => { settings.setModeIndicator(e.target.value as ModeIndicatorDisplay) }}
                  style={{ font: 'inherit', padding: '4px 8px' }}
                >
                  {MODE_INDICATOR_DISPLAYS.map(value => (
                    <option key={value} value={value}>{t(DISPLAY_LABEL_KEY[value])}</option>
                  ))}
                </select>
              </label>
              <p style={{ fontSize: 12, opacity: 0.65, margin: '8px 0 0' }}>{t('localOnly')}</p>
            </div>
          )
          : null}
      </li>
    )
  }
}
