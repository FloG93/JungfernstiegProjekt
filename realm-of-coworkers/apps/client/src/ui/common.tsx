// Gemeinsame Bausteine der Oberfläche: Schaltflächen, Fenster, Leisten, Symbole, Gegenstandskarten mit Vergleich (14.5).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ElementId, EquipSlot, HeroStateDTO, ItemDTO, StatBlock } from '@aethra/shared';
import { play, unlockAudio } from '../lib/audio';
import { content } from '../lib/content';
import { fmt, t } from '../lib/i18n';
import { CLASS_SYMBOL, ELEMENT_SYMBOL, RARITY_COLOR } from '../game/palette';
import type { ClassId } from '@aethra/shared';

export function Btn(p: {
  onClick?: () => unknown;
  children: ComponentChildren;
  kind?: 'primary' | 'ghost' | 'danger' | 'gold';
  disabled?: boolean;
  small?: boolean;
  testid?: string;
  title?: string;
  class?: string;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    unlockAudio();
    play('click');
    if (!p.onClick || busy) return;
    const r = p.onClick();
    if (r instanceof Promise) {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <button
      type="button"
      class={`btn ${p.kind ?? 'primary'} ${p.small ? 'small' : ''} ${p.class ?? ''}`}
      disabled={p.disabled || busy}
      onClick={() => void click()}
      data-testid={p.testid}
      title={p.title}
    >
      {p.children}
    </button>
  );
}

const modalStack: (() => void)[] = [];

/** Overlay-Fenster (14.1). Escape oder die Zurück-Schaltfläche schließt das oberste Fenster. */
export function Modal(p: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean; testid?: string }): JSX.Element {
  const close = useRef(p.onClose);
  close.current = p.onClose;
  useEffect(() => {
    const f = () => close.current();
    modalStack.push(f);
    return () => {
      const i = modalStack.lastIndexOf(f);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, []);
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class={`modal ${p.wide ? 'wide' : ''}`} role="dialog" aria-label={p.title} data-testid={p.testid}>
        <header>
          <h2>{p.title}</h2>
          <button type="button" class="x" aria-label={t('app.close')} onClick={() => p.onClose()}>✕</button>
        </header>
        <div class="modal-body">{p.children}</div>
      </div>
    </div>
  );
}

/** Schließt das oberste Fenster; true, wenn eines offen war. */
export function closeTopModal(): boolean {
  const f = modalStack[modalStack.length - 1];
  if (!f) return false;
  f();
  return true;
}

export function Bar(p: { value: number; max: number; color?: string; shield?: number; label?: string; marks?: number[]; class?: string }): JSX.Element {
  const frac = p.max > 0 ? Math.max(0, Math.min(1, p.value / p.max)) : 0;
  const sh = p.shield && p.max > 0 ? Math.min(1, p.shield / p.max) : 0;
  return (
    <div class={`bar ${p.class ?? ''}`} role="progressbar" aria-valuenow={Math.round(p.value)} aria-valuemax={Math.round(p.max)}>
      <div class="fill" style={{ width: `${frac * 100}%`, background: p.color }} />
      {sh > 0 && <div class="shield" style={{ width: `${sh * 100}%` }} />}
      {(p.marks ?? []).map((m) => <div class="mark" style={{ left: `${m}%` }} />)}
      {p.label && <span>{p.label}</span>}
    </div>
  );
}

export function El(p: { el: ElementId | null | undefined; label?: boolean }): JSX.Element | null {
  if (!p.el) return null;
  return (
    <span class={`el el-${p.el}`} title={t(`element.${p.el}`)}>
      {ELEMENT_SYMBOL[p.el]}
      {p.label && <> {t(`element.${p.el}`)}</>}
    </span>
  );
}

export function ClassIcon(p: { cls: ClassId }): JSX.Element {
  return <span class={`cls cls-${p.cls}`} title={t(`class.${p.cls}`)}>{CLASS_SYMBOL[p.cls]}</span>;
}

export function Gold(p: { n: number }): JSX.Element {
  return <span class="gold">◉ {fmt(p.n)}</span>;
}

export function Tabs<T extends string>(p: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }): JSX.Element {
  return (
    <div class="tabs" role="tablist">
      {p.options.map((o) => (
        <button type="button" role="tab" aria-selected={o.id === p.value} class={o.id === p.value ? 'on' : ''} onClick={() => p.onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Gegenstände (14.5) ----------

const STAT_KEYS = ['leb', 'kra', 'rue', 'res', 'tmp', 'krt'] as const;
const RECOMMEND_PCT = 5;

/** Ausrüstungsplatz, mit dem ein Gegenstand verglichen wird (Waffe: Satz A oder B). */
export function compareSlot(it: ItemDTO, weaponSet: 'A' | 'B'): EquipSlot {
  if (it.slot === 'waffe') return weaponSet === 'A' ? 'Waffe_A' : 'Waffe_B';
  return ({ ruestung: 'Ruestung', nebenhand: 'Nebenhand', helm: 'Helm', handschuhe: 'Handschuhe', umhang: 'Umhang', stiefel: 'Stiefel' } as const)[it.slot];
}

export function isRecommended(it: ItemDTO, cur: ItemDTO | undefined, level: number): boolean {
  if (it.requirement > level) return false;
  if (!cur) return true;
  return it.budget >= cur.budget * (1 + RECOMMEND_PCT / 100);
}

function Diff(p: { a: number; b: number; pct?: boolean }): JSX.Element | null {
  const d = p.a - p.b;
  if (Math.abs(d) < 0.05) return null;
  const pct = p.b !== 0 ? Math.round((d / Math.abs(p.b)) * 100) : null;
  return (
    <span class={d > 0 ? 'up' : 'down'}>
      {d > 0 ? '▲' : '▼'} {fmt(Math.abs(d), 1)}{p.pct ? ' %' : ''}{pct !== null ? ` (${pct > 0 ? '+' : ''}${pct} %)` : ''}
    </span>
  );
}

export function ItemName(p: { it: ItemDTO }): JSX.Element {
  return <span class={`iname r-${p.it.rarity}`} style={{ color: RARITY_COLOR[p.it.rarity] }}>{p.it.name}</span>;
}

/** Tooltip bzw. Detailkarte mit Vergleich gegen den angelegten Gegenstand (14.5). */
export function ItemInfo(p: { it: ItemDTO; cur?: ItemDTO | undefined; level: number; chapterEl?: ElementId | null }): JSX.Element {
  const { it, cur } = p;
  const c = content();
  const reqFail = it.requirement > p.level;
  // Gleiches Element wie das Kapitel: ×0,5; Gegenelement: ×1,5 (6.1)
  const weakVsChapter = !!it.element && it.element !== 'physisch' && it.element === p.chapterEl;
  const strongVsChapter = !!it.element && !!p.chapterEl && c.elementById[p.chapterEl].weakTo === it.element;
  return (
    <div class={`item-info r-${it.rarity}`}>
      <div class="ihead">
        <ItemName it={it} />
        <small>
          {t(`slot.${it.slot}`)} · {t(`rarity.${it.rarity}`)} · iLvl {it.ilvl}
          {' · '}<span class={reqFail ? 'bad' : ''}>{t('hero.level')} {it.requirement}</span>
        </small>
      </div>
      <table class="stats">
        <tbody>
          <tr>
            <td>{t('stat.budget')}</td>
            <td>{fmt(it.budget, 1)}</td>
            <td>{cur && <Diff a={it.budget} b={cur.budget} />}</td>
          </tr>
          {STAT_KEYS.map((k) => (it.stats[k] || cur?.stats[k]) ? (
            <tr>
              <td>{t(`stat.${k}`)}</td>
              <td>{fmt(it.stats[k], 1)}</td>
              <td>{cur && <Diff a={it.stats[k]} b={cur.stats[k]} />}</td>
            </tr>
          ) : null)}
          {(it.ele > 0 || (cur?.ele ?? 0) > 0) && (
            <tr>
              <td>{t('stat.ele')}</td>
              <td>{fmt(it.ele, 1)} %</td>
              <td>{cur && <Diff a={it.ele} b={cur.ele} pct />}</td>
            </tr>
          )}
        </tbody>
      </table>
      {it.slot === 'waffe' && (
        <div class="weapon-line">
          <El el={it.element} label /> · {t('progress.weaponLevel', { level: it.weaponLevel })}
          {it.enchants.length > 0 && <> · {it.enchants.map((e) => `${c.enchants.find((x) => x.id === e.id)?.name ?? e.id} ${e.rank}`).join(', ')}</>}
          {it.effectId && <div class="boss-effect">★ {c.bossById[it.effectId].name}</div>}
        </div>
      )}
      {weakVsChapter && <div class="warn">{t('loot.weakElementWarning')}</div>}
      {strongVsChapter && <div class="good">{t('loot.strongElement')}</div>}
      {cur && isRecommended(it, cur, p.level) && <div class="good">✔ {t('loot.recommended')}</div>}
      {!cur && it.requirement <= p.level && <div class="good">✔ {t('loot.recommended')}</div>}
      <div class="muted">{t('loot.sellPrice', { gold: it.sellPrice })}{it.locked ? ` · 🔒 ${t('loot.lock')}` : ''}</div>
    </div>
  );
}

/** Kleine Karte im Inventar. */
export function ItemTile(p: { it: ItemDTO; onClick?: () => void; badge?: string; selected?: boolean; testid?: string }): JSX.Element {
  const it = p.it;
  return (
    <button type="button" class={`tile r-${it.rarity} ${p.selected ? 'sel' : ''}`} onClick={() => p.onClick?.()} data-testid={p.testid}>
      <span class="slot-ico">{SLOT_ICON[it.slot]}</span>
      <span class="ilvl">{it.ilvl}</span>
      {it.slot === 'waffe' && <span class="tile-el"><El el={it.element} /></span>}
      {it.locked && <span class="lock">🔒</span>}
      {p.badge && <span class="badge">{p.badge}</span>}
    </button>
  );
}

export const SLOT_ICON: Record<ItemDTO['slot'], string> = {
  waffe: '⚔', ruestung: '🥋', nebenhand: '🛡', helm: '⛑', handschuhe: '🧤', umhang: '🧥', stiefel: '🥾',
};

/** Werte eines Helden (5, mit Obergrenzen). */
export function StatsView(p: { stats: StatBlock }): JSX.Element {
  const keys = ['leb', 'kra', 'rue', 'res', 'tmp', 'krt', 'ksd', 'ele'] as const;
  return (
    <dl class="statlist">
      {keys.map((k) => (
        <>
          <dt>{t(`stat.${k}`)}</dt>
          <dd>{fmt(p.stats[k], k === 'tmp' || k === 'krt' || k === 'ele' ? 1 : 0)}{k === 'krt' || k === 'ksd' || k === 'ele' || k === 'tmp' ? ' %' : ''}</dd>
        </>
      ))}
    </dl>
  );
}

/** Kapitel-Element der zuletzt freien Stage (für den Element-Hinweis bei Waffen). */
export function chapterElement(s: HeroStateDTO): ElementId | null {
  const top = Math.max(1, ...s.unlockedStages);
  const def = content().stages[top - 1];
  if (!def) return null;
  const boss = content().bosses.find((b) => b.chapter === def.chapter);
  return boss?.element ?? null;
}

/** Bestätigung als Fenster (statt window.confirm, das auf Mobilgeräten stört). */
export function Confirm(p: { text: string; onYes: () => void; onNo: () => void; yes?: string }): JSX.Element {
  return (
    <Modal title={t('app.confirm')} onClose={p.onNo}>
      <p>{p.text}</p>
      <div class="row end">
        <Btn kind="ghost" onClick={p.onNo}>{t('app.cancel')}</Btn>
        <Btn kind="danger" onClick={p.onYes} testid="confirm-yes">{p.yes ?? t('app.confirm')}</Btn>
      </div>
    </Modal>
  );
}
