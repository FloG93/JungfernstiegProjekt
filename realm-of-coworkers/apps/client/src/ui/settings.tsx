// Einstellungen (14.6, 14.9, E-023): Ton, Barrierefreiheit, Steuerung, Idle-Schalter des Helden.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { DEFAULT_KEYS, settings } from '../lib/settings';
import type { ColorBlind, Settings, TelegraphStyle } from '../lib/settings';
import { useStore } from '../lib/store';
import { errorToast, heroState, logout, refreshHero } from '../state';
import { Btn, Modal } from './common';

function Slider(p: { label: string; k: 'music' | 'sfx' | 'ui' | 'hudScale' | 'fontScale'; min: number; max: number; step: number; unit?: string }): JSX.Element {
  const s = useStore(settings);
  return (
    <label class="field slider">
      <span>{p.label}: {s[p.k]}{p.unit ?? ''}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={s[p.k]} onInput={(e) => settings.patch({ [p.k]: Number(e.currentTarget.value) } as Partial<Settings>)} />
    </label>
  );
}

function Toggle(p: { label: string; checked: boolean; onChange: (v: boolean) => void; testid?: string }): JSX.Element {
  return (
    <label class="switch">
      <input type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.currentTarget.checked)} data-testid={p.testid} />
      {p.label}
    </label>
  );
}

const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'roll', 's1', 's2', 's3', 'ult', 'potion', 'swap', 'target', 'autowalk', 'pause', 'chat'] as const;

function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return '␣';
  return code;
}

/** Tastenbelegung (14.6): Aktion antippen, dann die neue Taste drücken. Doppelte Belegung wird getauscht. */
function KeyBindings(): JSX.Element {
  const s = useStore(settings);
  const [wait, setWait] = useState<string | null>(null);
  useEffect(() => {
    if (!wait) return;
    const f = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        const keys = { ...settings.get().keys };
        const other = Object.entries(keys).find(([a, c]) => c === e.code && a !== wait);
        if (other) keys[other[0]] = keys[wait] ?? '';
        keys[wait] = e.code;
        settings.patch({ keys });
      }
      setWait(null);
    };
    window.addEventListener('keydown', f, { capture: true });
    return () => window.removeEventListener('keydown', f, { capture: true });
  }, [wait]);
  return (
    <div class="keys">
      {KEY_ACTIONS.map((a) => (
        <>
          <span>{t(`settings.key_${a}`)}</span>
          <button type="button" class={`btn ghost small ${wait === a ? 'wait' : ''}`} onClick={() => setWait(a)}>
            <kbd>{wait === a ? '…' : keyLabel(s.keys[a] ?? '')}</kbd>
          </button>
        </>
      ))}
      <span />
      <Btn small kind="ghost" onClick={() => settings.patch({ keys: { ...DEFAULT_KEYS } })}>{t('settings.keysReset')}</Btn>
    </div>
  );
}

export function SettingsView(p: { onClose: () => void }): JSX.Element {
  const s = useStore(settings);
  const hs = useStore(heroState);
  const heroSetting = async (patch: { autoPotion?: boolean; autoDodge?: boolean; autoContinue?: boolean }) => {
    if (!hs) return;
    try {
      await api.settings(hs.hero.id, patch);
      await refreshHero();
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Modal title={t('settings.title')} onClose={p.onClose} testid="settings">
      {hs && (
        <section>
          <h3>{t('settings.idle')}</h3>
          <Toggle label={t('settings.autoPotion')} checked={hs.hero.settings.autoPotion} onChange={(v) => void heroSetting({ autoPotion: v })} />
          <Toggle label={t('settings.autoDodge')} checked={hs.hero.settings.autoDodge} onChange={(v) => void heroSetting({ autoDodge: v })} />
          <Toggle label={t('settings.autoContinue')} checked={hs.hero.settings.autoContinue} onChange={(v) => void heroSetting({ autoContinue: v })} />
          <p class="muted small">{t('settings.idleHint')}</p>
        </section>
      )}
      <section>
        <h3>{t('settings.audio')}</h3>
        <Slider label={t('settings.music')} k="music" min={0} max={100} step={5} />
        <Slider label={t('settings.sfx')} k="sfx" min={0} max={100} step={5} />
        <Slider label={t('settings.ui')} k="ui" min={0} max={100} step={5} />
        <Toggle label={t('settings.mute')} checked={s.mute} onChange={(v) => settings.patch({ mute: v })} />
      </section>
      <section>
        <h3>{t('settings.accessibility')}</h3>
        <label class="field">
          {t('settings.telegraphStyle')}
          <select value={s.telegraph} onChange={(e) => settings.patch({ telegraph: e.currentTarget.value as TelegraphStyle })}>
            <option value="standard">{t('settings.telegraphStandard')}</option>
            <option value="outline">{t('settings.telegraphOutline')}</option>
            <option value="blue">{t('settings.telegraphBlue')}</option>
          </select>
        </label>
        <label class="field">
          {t('settings.colorBlind')}
          <select value={s.colorBlind} onChange={(e) => settings.patch({ colorBlind: e.currentTarget.value as ColorBlind })}>
            <option value="off">{t('settings.colorBlindOff')}</option>
            <option value="protan">{t('settings.colorBlindProtan')}</option>
            <option value="tritan">{t('settings.colorBlindTritan')}</option>
          </select>
        </label>
        <Slider label={t('settings.fontSize')} k="fontScale" min={100} max={150} step={25} unit=" %" />
        <Slider label={t('settings.hudScale')} k="hudScale" min={80} max={130} step={10} unit=" %" />
        <Toggle label={t('settings.reduceMotion')} checked={s.reduceMotion} onChange={(v) => settings.patch({ reduceMotion: v })} />
        <Toggle label={t('settings.edgeWarning')} checked={s.edgeWarning} onChange={(v) => settings.patch({ edgeWarning: v })} />
        <Toggle label={t('settings.damageNumbers')} checked={s.damageNumbers} onChange={(v) => settings.patch({ damageNumbers: v })} />
      </section>
      <section>
        <h3>{t('settings.controls')}</h3>
        <Toggle label={t('settings.leftHanded')} checked={s.leftHanded} onChange={(v) => settings.patch({ leftHanded: v })} />
        <p class="muted small">{t('settings.keysHint')}</p>
        <h3>{t('settings.keyBindings')}</h3>
        <KeyBindings />
      </section>
      <div class="row end">
        <Btn kind="danger" small onClick={logout}>{t('auth.logout')}</Btn>
      </div>
    </Modal>
  );
}
