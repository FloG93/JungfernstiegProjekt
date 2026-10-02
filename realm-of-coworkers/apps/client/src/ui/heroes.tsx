// Heldenauswahl und Erstellung (4.1, 14.1): bis zu 6 Helden je Konto, Klasse, Name, Aussehen.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { CLASS_IDS } from '@aethra/shared';
import type { Appearance, ClassId, HeroSummaryDTO } from '@aethra/shared';
import { api } from '../lib/api';
import { content } from '../lib/content';
import { t } from '../lib/i18n';
import { useStore } from '../lib/store';
import { chooseHero, errorToast, heroes, logout } from '../state';
import { CLASS_COLOR, css, shade } from '../game/palette';
import { Btn, ClassIcon, Modal } from './common';

export function HeroPortrait(p: { cls: ClassId; look: Appearance; size?: number }): JSX.Element {
  const base = shade(CLASS_COLOR[p.cls], (p.look.palette % 6 - 2.5) * 0.08);
  const s = p.size ?? 56;
  return (
    <div class="portrait" style={{ width: `${s}px`, height: `${s}px`, background: `radial-gradient(circle at 50% 35%, ${css(shade(base, 0.3))}, ${css(shade(base, -0.4))})` }}>
      <ClassIcon cls={p.cls} />
      <span class="pnum">{p.look.portrait + 1}</span>
    </div>
  );
}

function CreateHero(p: { onDone: () => void; taken: Set<ClassId> }): JSX.Element {
  const c = content();
  const [cls, setCls] = useState<ClassId>(CLASS_IDS.find((x) => !p.taken.has(x)) ?? 'krieger');
  const [name, setName] = useState('');
  const [look, setLook] = useState<Appearance>({ body: 0, portrait: 0, palette: 0 });
  const ap = c.engine.appearance;
  const step = (k: keyof Appearance, max: number) => setLook({ ...look, [k]: (look[k] + 1) % max });
  const create = async () => {
    try {
      const h = await api.createHero(name.trim(), cls, look);
      heroes.set([...heroes.get(), h]);
      await chooseHero(h.id);
      p.onDone();
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Modal title={t('hero.create')} onClose={p.onDone} testid="hero-create">
      <div class="class-grid">
        {CLASS_IDS.map((id) => (
          <button type="button" class={`class-card ${cls === id ? 'on' : ''}`} disabled={p.taken.has(id)} onClick={() => setCls(id)} data-testid={`class-${id}`}>
            <HeroPortrait cls={id} look={look} size={44} />
            <b>{t(`class.${id}`)}</b>
            <small>{t(`role.${id}`)}</small>
          </button>
        ))}
      </div>
      <label class="field">
        {t('hero.name')}
        <input value={name} maxLength={c.engine.limits.heroNameMax} onInput={(e) => setName(e.currentTarget.value)} data-testid="hero-name" />
      </label>
      <div class="row look">
        <HeroPortrait cls={cls} look={look} size={72} />
        <div class="col">
          <Btn small kind="ghost" onClick={() => step('body', ap.bodies)}>{t('hero.body')} {look.body + 1}/{ap.bodies}</Btn>
          <Btn small kind="ghost" onClick={() => step('portrait', ap.portraits)}>{t('hero.portrait')} {look.portrait + 1}/{ap.portraits}</Btn>
          <Btn small kind="ghost" onClick={() => step('palette', ap.palettes)}>{t('hero.palette')} {look.palette + 1}/{ap.palettes}</Btn>
        </div>
      </div>
      <div class="row end">
        <Btn onClick={create} disabled={name.trim().length < c.engine.limits.heroNameMin} testid="hero-create-submit">{t('hero.create')}</Btn>
      </div>
    </Modal>
  );
}

export function HeroSelect(): JSX.Element {
  const list = useStore(heroes);
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<HeroSummaryDTO | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const max = CLASS_IDS.length;
  return (
    <div class="screen heroes">
      <header class="topbar">
        <h1>{t('hero.select')}</h1>
        <Btn kind="ghost" small onClick={logout}>{t('auth.logout')}</Btn>
      </header>
      <div class="hero-cards">
        {list.map((h) => (
          <div class="hero-card">
            <button type="button" class="pick" onClick={() => void chooseHero(h.id).catch(errorToast)} data-testid={`hero-${h.name}`}>
              <HeroPortrait cls={h.classId} look={h.appearance} />
              <div>
                <b>{h.name}</b>
                <small>{t(`class.${h.classId}`)} · {t('hero.level')} {h.level}</small>
              </div>
            </button>
            <button type="button" class="del" aria-label={t('hero.delete')} onClick={() => setDel(h)}>🗑</button>
          </div>
        ))}
        {list.length < max && (
          <button type="button" class="hero-card new" onClick={() => setCreating(true)} data-testid="hero-new">＋ {t('hero.create')}</button>
        )}
      </div>
      {creating && <CreateHero onDone={() => setCreating(false)} taken={new Set(list.map((h) => h.classId))} />}
      {del && (
        <Modal title={t('hero.delete')} onClose={() => setDel(null)}>
          <p>{t('hero.deleteConfirm')}</p>
          <input value={confirmName} onInput={(e) => setConfirmName(e.currentTarget.value)} placeholder={del.name} />
          <div class="row end">
            <Btn kind="danger" disabled={confirmName !== del.name} onClick={async () => {
              try {
                await api.deleteHero(del.id, confirmName);
                heroes.set(list.filter((x) => x.id !== del.id));
                setDel(null);
                setConfirmName('');
              } catch (e) {
                errorToast(e);
              }
            }}>{t('hero.delete')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
