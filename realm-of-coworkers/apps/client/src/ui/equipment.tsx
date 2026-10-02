// Ausrüstung (14.1, 14.5): Puppe mit 8 Plätzen, Werte je Waffensatz, Inventar (80) und Truhe (40),
// Detailkarte mit Vergleich und Aktionen (anlegen, ablegen, verkaufen, sperren, in die Truhe).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { EQUIP_SLOTS } from '@aethra/shared';
import type { EquipSlot, HeroStateDTO, ItemDTO } from '@aethra/shared';
import { api } from '../lib/api';
import { content } from '../lib/content';
import { t } from '../lib/i18n';
import { useStore } from '../lib/store';
import { applyState, errorToast, heroState, toast } from '../state';
import {
  Btn, Confirm, Gold, ItemInfo, ItemTile, Modal, SLOT_ICON, StatsView, Tabs, chapterElement, compareSlot, isRecommended,
} from './common';

const SLOT_OF_EQUIP: Record<EquipSlot, ItemDTO['slot']> = {
  Waffe_A: 'waffe', Waffe_B: 'waffe', Ruestung: 'ruestung', Nebenhand: 'nebenhand', Helm: 'helm', Handschuhe: 'handschuhe',
  Umhang: 'umhang', Stiefel: 'stiefel',
};

function slotLabel(s: EquipSlot): string {
  if (s === 'Waffe_A') return `${t('slot.waffe')} A`;
  if (s === 'Waffe_B') return `${t('slot.waffe')} B`;
  return t(`slot.${SLOT_OF_EQUIP[s]}`);
}

export function ItemDetail(p: { it: ItemDTO; s: HeroStateDTO; onClose: () => void }): JSX.Element {
  const { it, s } = p;
  const id = s.hero.id;
  const [set, setSet] = useState<'A' | 'B'>('A');
  const [confirmSell, setConfirmSell] = useState(false);
  const slot = it.equipSlot ?? compareSlot(it, set);
  const cur = it.equipSlot ? undefined : s.equipped[slot];
  const run = async (f: () => Promise<{ state: HeroStateDTO }>, close = true) => {
    try {
      const r = await f();
      applyState(r.state);
      if (close) p.onClose();
    } catch (e) {
      errorToast(e);
    }
  };
  const sell = async () => {
    try {
      const r = await api.sell(id, [it.id], true);
      applyState(r.state);
      toast(t('loot.sold', { gold: r.result.gold }), 'good');
      p.onClose();
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <Modal title={it.name} onClose={p.onClose} testid="item-detail">
      {it.slot === 'waffe' && !it.equipSlot && (
        <Tabs value={set} onChange={setSet} options={[{ id: 'A', label: t('smith.setA') }, { id: 'B', label: t('smith.setB') }]} />
      )}
      <div class="compare">
        <ItemInfo it={it} cur={cur} level={s.hero.level} chapterEl={chapterElement(s)} />
        {cur && (
          <div class="compare-cur">
            <small class="muted">{t('loot.equipped')}</small>
            <ItemInfo it={cur} level={s.hero.level} />
          </div>
        )}
      </div>
      <div class="row wrap actions">
        {it.equipSlot ? (
          <Btn kind="ghost" disabled={s.inRun} onClick={() => run(() => api.unequip(id, it.equipSlot!))} testid="item-unequip">{t('loot.unequip')}</Btn>
        ) : (
          <Btn disabled={s.inRun || it.requirement > s.hero.level} onClick={() => run(() => api.equip(id, it.id, it.slot === 'waffe' ? slot : undefined))} testid="item-equip">
            {t('loot.equip')}{it.slot === 'waffe' ? ` (${set})` : ''}
          </Btn>
        )}
        <Btn kind="ghost" onClick={() => run(() => api.lock(id, it.id, !it.locked), false)}>{it.locked ? t('loot.unlock') : t('loot.lock')}</Btn>
        {!it.equipSlot && (
          <Btn kind="ghost" onClick={() => run(() => api.stash(id, it.id, !it.stash))}>{it.stash ? t('loot.toInventory') : t('loot.toStash')}</Btn>
        )}
        {!it.equipSlot && !it.locked && <Btn kind="danger" onClick={() => setConfirmSell(true)} testid="item-sell">{t('loot.sell')} (<Gold n={it.sellPrice} />)</Btn>}
      </div>
      {confirmSell && <Confirm text={t('loot.sellConfirm', { name: it.name, gold: it.sellPrice })} onNo={() => setConfirmSell(false)} onYes={() => void sell()} />}
    </Modal>
  );
}

export function Equipment(p: { onClose: () => void }): JSX.Element {
  const s = useStore(heroState);
  const [tab, setTab] = useState<'inv' | 'stash'>('inv');
  const [sel, setSel] = useState<ItemDTO | null>(null);
  const [statSet, setStatSet] = useState<'A' | 'B'>('A');
  if (!s) return <Modal title={t('camp.equipment')} onClose={p.onClose}>{t('app.loading')}</Modal>;
  const list = tab === 'inv' ? s.inventory : s.stash;
  const cap = tab === 'inv' ? content().balance.items.inventory : content().balance.items.stash;
  const selNow = sel ? [...s.inventory, ...s.stash, ...Object.values(s.equipped)].find((x) => x?.id === sel.id) ?? null : null;
  const recommended = (it: ItemDTO) => isRecommended(it, s.equipped[compareSlot(it, 'A')], s.hero.level);
  return (
    <Modal title={t('camp.equipment')} onClose={p.onClose} wide testid="equipment">
      {s.inRun && <div class="warn">{t('error.HERO_IN_RUN')}</div>}
      <div class="equip-layout">
        <section class="doll">
          {EQUIP_SLOTS.map((slot) => {
            const it = s.equipped[slot];
            return (
              <button type="button" class={`doll-slot ${it ? `r-${it.rarity}` : 'empty'}`} onClick={() => it && setSel(it)} data-testid={`slot-${slot}`}>
                <span class="slot-ico">{SLOT_ICON[SLOT_OF_EQUIP[slot]]}</span>
                <span class="slot-name">{slotLabel(slot)}</span>
                {it && <span class="slot-item">{it.name}</span>}
              </button>
            );
          })}
        </section>
        <section class="statbox">
          <Tabs value={statSet} onChange={setStatSet} options={[{ id: 'A', label: t('smith.setA') }, { id: 'B', label: t('smith.setB') }]} />
          <StatsView stats={s.stats[statSet]} />
        </section>
      </div>
      <Tabs value={tab} onChange={setTab} options={[
        { id: 'inv', label: `${t('loot.inventory')} ${s.inventory.length}/${content().balance.items.inventory}` },
        { id: 'stash', label: `${t('loot.stash')} ${s.stash.length}/${content().balance.items.stash}` },
      ]} />
      <div class="grid-items" data-testid="inventory">
        {list.map((it) => <ItemTile it={it} onClick={() => setSel(it)} badge={recommended(it) ? '▲' : undefined} testid={`inv-${it.id}`} />)}
        {Array.from({ length: Math.max(0, Math.min(cap, 20) - list.length) }).map(() => <div class="tile empty" />)}
      </div>
      {selNow && <ItemDetail it={selNow} s={s} onClose={() => setSel(null)} />}
    </Modal>
  );
}
