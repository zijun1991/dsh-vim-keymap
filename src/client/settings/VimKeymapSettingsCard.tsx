/**
 * This plugin's card in Settings -> Plugins -> Plugin Configuration
 * (`settings.plugin.item`, declared by `@deepseek-ai/dsh-client-ui-settings-plugins`).
 * The mode-badge display policy (a `<select>`) applies instantly on change;
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
 *
 * The two shortcut fields (`enterNormal`/`enterSession`) commit on blur/Enter
 * rather than on every keystroke — a combo string is only meaningful once
 * finished (e.g. "Shift+Escape" is unparseable mid-type as "Shift+Esc"), so
 * committing per-keystroke would reject-then-accept on every character.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { MODE_INDICATOR_DISPLAYS } from '../../settings.js'
import type { ModeIndicatorDisplay } from '../../settings.js'
import type { LocalKeymapSettingsStore } from './local-store.js'
import type { VimKeymapSettingsLocaleKey } from './locales.js'

const DISPLAY_LABEL_KEY: Record<ModeIndicatorDisplay, VimKeymapSettingsLocaleKey> = {
  persistent: 'persistent',
  'on-change': 'onChange',
  hidden: 'hidden',
}

interface ShortcutFieldProps {
  readonly label: string
  readonly hint: string
  readonly invalidMessage: string
  readonly value: string
  readonly onCommit: (next: string) => boolean
}

function ShortcutField({ label, hint, invalidMessage, value, onCommit }: ShortcutFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)

  // The store's own canonical formatting (see local-store.ts's setEnterNormal/
  // setEnterSession) can differ from what the user typed (e.g. "escape" ->
  // "Escape") — resync the draft whenever the committed value actually changes.
  useEffect(() => { setDraft(value); setInvalid(false) }, [value])

  const commit = (): void => {
    if (draft.trim() === value) { setInvalid(false); return }
    setInvalid(!onCommit(draft.trim()))
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginTop: 12 }}>
      <span>{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={hint}
        onChange={(e) => { setDraft(e.target.value) }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          commit()
          e.currentTarget.blur()
        }}
        style={{ font: 'inherit', padding: '4px 8px' }}
      />
      {invalid ? <span style={{ color: '#e05d5d', fontSize: 11 }}>{invalidMessage}</span> : null}
    </label>
  )
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
              <ShortcutField
                label={t('enterNormalLabel')}
                hint={t('shortcutHint')}
                invalidMessage={t('invalidShortcut')}
                value={snapshot.enterNormal}
                onCommit={(next) => settings.setEnterNormal(next)}
              />
              <ShortcutField
                label={t('enterSessionLabel')}
                hint={t('shortcutHint')}
                invalidMessage={t('invalidShortcut')}
                value={snapshot.enterSession}
                onCommit={(next) => settings.setEnterSession(next)}
              />
              <p style={{ fontSize: 12, opacity: 0.65, margin: '8px 0 0' }}>{t('localOnly')}</p>
            </div>
          )
          : null}
      </li>
    )
  }
}
