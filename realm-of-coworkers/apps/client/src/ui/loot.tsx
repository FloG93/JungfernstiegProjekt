// Beute-Bildschirm (9.1, 10.8, 14.5): Ergebnis, XP und Gold, Stufenaufstiege, neue Gegenstände als Karten mit
// Vergleich (antippen: anlegen, verkaufen), „Alles Empfohlene anlegen“, Weiter oder Lager, Auto-Weiter (E-023).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { HeroStateDTO, ItemDTO } from '@aethra/shared';
import { api } from '../lib/api';
import { content } from '../lib/content';
import { fmt, t } from '../lib/i18n';
import { net } from '../lib/net';
import { useStore } from '../lib/store';
import { applyState, errorToast, heroState, loot, me, party, screen } from '../state';
import { Btn, Gold, ItemInfo, compareSlot, isRecommended } from './common';
import { ItemDetail } from './equipment';

function liveItem(s: HeroStateDTO | null, it: ItemDTO): ItemDTO | null {
  if (!s) return it;
  return [...s.inventory, ...s.stash, ...Object.values(s.equipped)].find((x) => x?.id === it.id) ?? null;
}

export function LootScreen(): JSX.Element {
  const r = useStore(loot);
  const s = useStore(heroState);
  const pt = useStore(party);
  const self = useStore(me);
  const [sel, setSel] = useState<ItemDTO | null>(null);
  const [opened, setOpened] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [shownAt] = useState(Date.now());
  useEffect(() => {
    const h = setTimeout(() => setOpened(true), 600);
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(h);
      clearInterval(i);
    };
  }, []);
  if (!r) {
    screen.set('camp');
    return <div />;
  }
  const c = content();
  const leader = pt?.leader === self?.accountId;
  const items = r.loot.map((it) => liveItem(s, it)).filter((x): x is ItemDTO => !!x);
  const recommended = s ? items.filter((it) => !it.equipSlot && isRecommended(it, s.equipped[compareSlot(it, 'A')], s.hero.level)) : [];
  const autoLeft = r.autoContinueIn !== null && pt?.autoContinue ? Math.max(0, r.autoContinueIn - (now - shownAt)) : null;
  const equipAll = async () => {
    if (!s) return;
    try {
      let st = s;
      for (const it of recommended) {
        const res = await api.equip(st.hero.id, it.id, it.slot === 'waffe' ? compareSlot(it, 'A') : undefined);
        st = res.state;
      }
      applyState(st);
    } catch (e) {
      errorToast(e);
    }
  };
  const toCamp = () => {
    if (leader) net.send({ t: 'run.next', stage: null });
    loot.set(null);
    screen.set('camp');
  };
  const next = () => {
    if (r.next !== null) net.send({ t: 'run.next', stage: r.next });
  };
  const bossStage = !!c.stages[r.stage - 1]?.boss;
  return (
    <div class="screen loot" data-testid="loot">
      <header>
        <h1>{r.result === 'win' ? (bossStage ? t('loot.victoryBoss') : t('loot.victory')) : t('loot.aborted')}</h1>
        <small class="muted">{t('stageSelect.stage', { chapter: Math.ceil(r.stage / 5), index: ((r.stage - 1) % 5) + 1 })} · {Math.round(r.timeMs / 1000)} s{r.firstClear && r.result === 'win' ? ` · ${t('loot.firstClear')}` : ''}</small>
      </header>
      <div class={`chest ${opened ? 'open' : ''}`} aria-hidden="true">🧰</div>
      <div class="loot-sums">
        <span>+{fmt(r.xp)} {t('loot.xp')}</span>
        <span>+<Gold n={r.gold} /></span>
        {r.splinters > 0 && <span>+{r.splinters} {t('loot.splinters')}</span>}
        {r.weaponXp > 0 && <span>+{fmt(r.weaponXp)} {t('loot.weaponXp')}</span>}
      </div>
      {r.helper && <p class="warn">{t('boss.helper')}</p>}
      {r.levelUps.map((l) => <p class="good">⬆ {t('progress.levelUp', { level: l })}</p>)}
      {r.weaponLevelUps.map((l) => <p class="good">⚔ {t('progress.weaponLevel', { level: l })}</p>)}
      {r.artifactUnlocked && <p class="good">✦ {t('progress.artifactUnlocked', { name: c.artifactById.get(`${s?.hero.classId}_${r.artifactUnlocked}`)?.name ?? r.artifactUnlocked })}</p>}
      {r.gems.length > 0 && <p>◆ {r.gems.map((g) => `${c.gems.tierNames[g.tier - 1]} ${t(`gem.${g.kind}`)}`).join(', ')}</p>}
      {r.autoSold.length > 0 && <p class="muted">{t('loot.autoSold', { n: r.autoSold.length, gold: r.autoSold.reduce((a, x) => a + x.gold, 0) })}</p>}
      <div class="loot-cards">
        {items.map((it) => {
          const cur = s && !it.equipSlot ? s.equipped[compareSlot(it, 'A')] : undefined;
          return (
            <button type="button" class={`loot-card r-${it.rarity} ${opened ? 'show' : ''}`} onClick={() => setSel(it)} data-testid={`loot-${it.id}`}>
              {it.equipSlot && <span class="tag">{t('loot.equipped')}</span>}
              <ItemInfo it={it} cur={cur} level={s?.hero.level ?? 1} />
            </button>
          );
        })}
        {items.length === 0 && r.loot.length > 0 && <p class="muted">{t('loot.alreadyHandled')}</p>}
      </div>
      <div class="row wrap center">
        {recommended.length > 0 && <Btn kind="gold" onClick={equipAll} testid="loot-equip-all">{t('loot.equipAll')} ({recommended.length})</Btn>}
      </div>
      <footer class="row wrap center">
        <Btn kind="ghost" onClick={toCamp} testid="loot-camp">{t('loot.toCamp')}</Btn>
        {leader && r.next !== null && <Btn onClick={next} testid="loot-next">{t('loot.next')}{autoLeft !== null ? ` (${Math.ceil(autoLeft / 1000)})` : ''}</Btn>}
        {!leader && pt && <span class="muted">{t('loot.waitLeader')}</span>}
      </footer>
      {sel && s && liveItem(s, sel) && <ItemDetail it={liveItem(s, sel)!} s={s} onClose={() => setSel(null)} />}
    </div>
  );
}
