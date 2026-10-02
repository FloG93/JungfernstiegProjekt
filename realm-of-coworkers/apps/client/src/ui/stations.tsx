// Stationen des Lagers (14.2): Schmiede, Juwelier, Archiv, Bosstafel. Jede Aktion zeigt Kosten vor der Bestätigung.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  ARTIFACT_SLOTS, ELEMENT_IDS, ENCHANT_IDS, GEM_IDS, elementChangeCost, enchantRankCost, freeGemSlots, gemCombineCost,
  gemSwapCost, storyLines, transferCost,
} from '@aethra/shared';
import type { ElementId, GemDTO, GemId, HeroStateDTO } from '@aethra/shared';
import { api } from '../lib/api';
import { content } from '../lib/content';
import { fmt, fmtTime, t } from '../lib/i18n';
import { useStore } from '../lib/store';
import { applyState, errorToast, heroState, party, serverOffset, toast } from '../state';
import { Btn, Confirm, El, Gold, ItemInfo, ItemName, Modal, Tabs } from './common';

type Mut = () => Promise<{ state: HeroStateDTO }>;

function useMutate(): (f: Mut, ok?: string) => Promise<void> {
  return async (f, ok) => {
    try {
      const r = await f();
      applyState(r.state);
      if (ok) toast(ok, 'good');
    } catch (e) {
      errorToast(e);
    }
  };
}

function Locked(p: { s: HeroStateDTO }): JSX.Element | null {
  return p.s.inRun ? <div class="warn">{t('error.HERO_IN_RUN')}</div> : null;
}

// ---------- Schmiede ----------

export function Smith(p: { onClose: () => void }): JSX.Element {
  const s = useStore(heroState);
  const [set, setSet] = useState<'A' | 'B'>('A');
  const [ask, setAsk] = useState<{ text: string; run: () => Promise<void> } | null>(null);
  const mutate = useMutate();
  if (!s) return <Modal title={t('camp.smith')} onClose={p.onClose}>{t('app.loading')}</Modal>;
  const c = content();
  const id = s.hero.id;
  const w = s.equipped[set === 'A' ? 'Waffe_A' : 'Waffe_B'];
  const others = [...s.inventory, ...s.stash].filter((x) => x.slot === 'waffe' && w && x.weaponLevel > w.weaponLevel);
  const maxLevel = c.balance.weapon.maxLevel;
  const ench = c.balance.weapon.enchant;
  return (
    <Modal title={`${t('camp.smith')} · Torbek`} onClose={p.onClose} wide testid="smith">
      <Locked s={s} />
      <Tabs value={set} onChange={setSet} options={[{ id: 'A', label: t('smith.setA') }, { id: 'B', label: t('smith.setB') }]} />
      {!w && <p class="muted">{t('smith.noWeapon')}</p>}
      {w && (
        <>
          <ItemInfo it={w} level={s.hero.level} />
          <h3>{t('smith.changeElement')}</h3>
          {w.rarity === 'legendaer' ? <p class="muted">{t('smith.legendaryElement')}</p> : (
            <div class="row wrap">
              {ELEMENT_IDS.filter((e) => e !== w.element).map((e: ElementId) => (
                <Btn small kind="ghost" disabled={s.inRun} onClick={() => setAsk({
                  text: `${t('smith.changeElement')}: ${t(`element.${e}`)} · ${t('smith.cost', { gold: elementChangeCost(c.balance, w.ilvl) })}`,
                  run: () => mutate(() => api.element(id, w.id, e)),
                })}><El el={e} label /></Btn>
              ))}
            </div>
          )}
          <h3>{t('smith.transferLevel')}</h3>
          {others.length === 0 ? <p class="muted">{t('smith.noTransfer')}</p> : (
            <div class="list">
              {others.map((o) => (
                <div class="row between">
                  <span><ItemName it={o} /> · {t('progress.weaponLevel', { level: o.weaponLevel })}</span>
                  <Btn small disabled={s.inRun} onClick={() => setAsk({
                    text: `${t('smith.transferWarning')} ${t('smith.cost', { gold: transferCost(c.balance, o.weaponLevel) })}`,
                    run: () => mutate(() => api.transfer(id, o.id, w.id)),
                  })}>{t('smith.transfer')}</Btn>
                </div>
              ))}
            </div>
          )}
          <h3>{t('smith.enchant')}</h3>
          {w.weaponLevel < maxLevel ? <p class="muted">{t('smith.needsLevel10')}</p> : (
            <div class="enchant-lines">
              {Array.from({ length: ench.lines }).map((_, line) => {
                const cur = w.enchants[line];
                const usable = line <= w.enchants.length;
                return (
                  <div class="enchant-line" data-testid={`enchant-line-${line}`}>
                    <b>{t('smith.line', { n: line + 1 })}</b>
                    {cur ? (
                      <span>{c.enchants.find((x) => x.id === cur.id)?.name} · {t('smith.rank')} {cur.rank}/{ench.maxRank}</span>
                    ) : <span class="muted">—</span>}
                    {usable && (
                      <select disabled={s.inRun} value="" onChange={(e) => {
                        const type = e.currentTarget.value;
                        if (!type) return;
                        setAsk({
                          text: `${t('smith.changeType')}: ${c.enchants.find((x) => x.id === type)?.name}${cur ? ` · ${t('smith.enchantLost')} ${t('smith.cost', { gold: ench.changeTypeGold })}` : ''}`,
                          run: () => mutate(() => api.enchant(id, w.id, line, 'type', type)),
                        });
                      }} data-testid={`enchant-type-${line}`}>
                        <option value="">{cur ? t('smith.changeType') : t('smith.chooseType')}</option>
                        {ENCHANT_IDS.filter((x) => !w.enchants.some((l) => l.id === x)).map((x) => (
                          <option value={x}>{c.enchants.find((d) => d.id === x)?.name}</option>
                        ))}
                      </select>
                    )}
                    {cur && cur.rank < ench.maxRank && (
                      <Btn small disabled={s.inRun} testid={`enchant-rank-${line}`} onClick={() => mutate(() => api.enchant(id, w.id, line, 'rank'), t('smith.enchanted'))}>
                        {t('smith.rankUp')} (<Gold n={enchantRankCost(c.balance, cur.rank + 1)} />)
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {ask && <Confirm text={ask.text} onNo={() => setAsk(null)} onYes={() => {
        const r = ask.run;
        setAsk(null);
        void r();
      }} />}
    </Modal>
  );
}

// ---------- Juwelier ----------

export function Jeweler(p: { onClose: () => void }): JSX.Element {
  const s = useStore(heroState);
  const [pick, setPick] = useState<number | null>(null);
  const [kindFilter, setKindFilter] = useState<GemId | 'all'>('all');
  const mutate = useMutate();
  if (!s) return <Modal title={t('camp.jeweler')} onClose={p.onClose}>{t('app.loading')}</Modal>;
  const c = content();
  const g = c.gems;
  const id = s.hero.id;
  const free = freeGemSlots(g, s.hero.level);
  const socketed = new Map(s.gems.filter((x) => x.socket !== null).map((x) => [x.socket!, x]));
  const bag = s.gems.filter((x) => x.socket === null && (kindFilter === 'all' || x.kind === kindFilter));
  const groups = new Map<string, GemDTO[]>();
  for (const x of bag) {
    const k = `${x.kind}:${x.tier}`;
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const gemName = (x: { kind: GemId; tier: number }) => `${g.tierNames[x.tier - 1] ?? ''} ${t(`gem.${x.kind}`)}`;
  // Wert = Punkte der Stufe × Wert je Punkt (7.2)
  const gemValue = (x: { kind: GemId; tier: number }) => {
    const stat = c.gemStat[x.kind] as keyof typeof c.balance.stats.perPoint;
    const pct = stat === 'tmp' || stat === 'krt' || stat === 'ksd' ? ' %' : '';
    return `+${fmt((g.tierPoints[x.tier - 1] ?? 0) * (c.balance.stats.perPoint[stat] ?? 0), 2)}${pct} ${t(`stat.${stat}`)}`;
  };
  return (
    <Modal title={`${t('camp.jeweler')} · Ysolde`} onClose={p.onClose} wide testid="jeweler">
      <Locked s={s} />
      <h3>{t('jeweler.slots')}</h3>
      <div class="sockets">
        {g.slotUnlockLevels.map((lvl, i) => {
          const gem = socketed.get(i);
          const locked = i >= free;
          return (
            <button type="button" class={`socket ${locked ? 'locked' : ''} ${gem ? 'filled' : ''}`} disabled={locked || s.inRun} data-testid={`socket-${i}`}
              onClick={() => {
                if (pick !== null) {
                  void mutate(() => api.socket(id, pick, i));
                  setPick(null);
                } else if (gem) void mutate(() => api.unsocket(id, i));
              }}>
              {locked ? <small>{t('jeweler.lockedSlot', { level: lvl })}</small> : gem ? (
                <><span class={`gem gem-${gem.kind}`}>◆</span><small>{gemName(gem)}</small></>
              ) : <small>{pick !== null ? t('jeweler.socket') : '—'}</small>}
            </button>
          );
        })}
      </div>
      <h3>{t('jeweler.bag')}</h3>
      <div class="row wrap">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.currentTarget.value as GemId | 'all')}>
          <option value="all">{t('jeweler.allKinds')}</option>
          {GEM_IDS.map((k) => <option value={k}>{t(`gem.${k}`)}</option>)}
        </select>
      </div>
      {groups.size === 0 && <p class="muted">{t('jeweler.empty')}</p>}
      <div class="list gems">
        {[...groups.entries()].sort().map(([key, list]) => {
          const x = list[0]!;
          const canCombine = list.length >= 3 && x.tier < g.tierPoints.length;
          return (
            <div class={`gem-row ${pick === x.id ? 'sel' : ''}`} data-testid={`gem-${key}`}>
              <span class={`gem gem-${x.kind}`}>◆</span>
              <span class="grow">{gemName(x)} ×{list.length}<br /><small class="muted">{gemValue(x)}</small></span>
              <Btn small kind="ghost" disabled={s.inRun} onClick={() => setPick(pick === x.id ? null : x.id)}>{t('jeweler.socket')}</Btn>
              {canCombine && (
                <Btn small disabled={s.inRun} testid={`combine-${key}`} onClick={() => mutate(() => api.combine(id, x.kind, x.tier), t('jeweler.combined'))}>
                  {t('jeweler.combine')} (<Gold n={gemCombineCost(g, x.tier)} />)
                </Btn>
              )}
              <select disabled={s.inRun} value="" onChange={(e) => {
                const k = e.currentTarget.value as GemId;
                if (k) void mutate(() => api.swapGem(id, x.id, k));
              }}>
                <option value="">{t('jeweler.swap')} ({fmt(gemSwapCost(g, x.tier))})</option>
                {GEM_IDS.filter((k) => k !== x.kind).map((k) => <option value={k}>{t(`gem.${k}`)}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {pick !== null && <p class="hint">{t('jeweler.pickSocket')}</p>}
    </Modal>
  );
}

// ---------- Archiv ----------

export function Archive(p: { onClose: () => void }): JSX.Element {
  const s = useStore(heroState);
  const mutate = useMutate();
  const [tab, setTab] = useState<'art' | 'chronicle'>('art');
  if (!s) return <Modal title={t('camp.archive')} onClose={p.onClose}>{t('app.loading')}</Modal>;
  const c = content();
  const id = s.hero.id;
  const seen = new Set(s.storySeen);
  return (
    <Modal title={`${t('camp.archive')} · Nerith`} onClose={p.onClose} wide testid="archive">
      <Locked s={s} />
      <Tabs value={tab} onChange={setTab} options={[{ id: 'art', label: t('archive.artifacts') }, { id: 'chronicle', label: t('archive.chronicle') }]} />
      {tab === 'art' && (
        <>
          <p>{t('archive.splinters', { n: s.hero.splinters })}</p>
          {ARTIFACT_SLOTS.map((slot) => {
            const a = s.artifacts.find((x) => x.slot === slot);
            const def = c.artifactById.get(`${s.hero.classId}_${slot}`);
            if (!def) return null;
            const rank = a?.rank ?? 0;
            const cost = def.rankCost[rank];
            return (
              <div class="artifact" data-testid={`artifact-${slot}`}>
                <div class="row between">
                  <b>{def.name}</b>
                  <span>{t(`slot.${slot}`)} · {t('smith.rank')} {rank}/{def.rankPoints.length}</span>
                </div>
                {!a?.unlocked && <p class="muted">{t('archive.locked', { boss: c.bossById[def.unlockBoss].name })}</p>}
                <p class="muted">{t(`artifact.${def.id}`)}</p>
                {a?.unlocked && rank < def.rankPoints.length && (
                  <Btn small disabled={s.inRun || (cost ?? 0) > s.hero.splinters} onClick={() => mutate(() => api.upgradeArtifact(id, slot), t('archive.upgraded'))}>
                    {t('archive.upgrade')} ({cost} {t('loot.splinters')})
                  </Btn>
                )}
                {rank >= def.rankPoints.length && <p class="good">{t('archive.maxRank')}</p>}
              </div>
            );
          })}
        </>
      )}
      {tab === 'chronicle' && (
        <div class="chronicle">
          {c.story.map((sf) => (
            <>
              <h3>{t('stageSelect.chapter', { n: sf.chapter })}</h3>
              {Object.entries(sf.stageIntros).filter(([k]) => seen.has(k)).map(([, text]) => <p>{text}</p>)}
              {Object.keys(sf.dialogs).filter((k) => seen.has(k)).map((k) => (
                <div class="dialog">{storyLines(c, sf.chapter, k).map((l) => <p><b>{l.speaker}:</b> {l.text}</p>)}</div>
              ))}
            </>
          ))}
          {seen.size === 0 && <p class="muted">{t('archive.empty')}</p>}
        </div>
      )}
    </Modal>
  );
}

// ---------- Bosstafel ----------

export function BossBoard(p: { onClose: () => void; onFight: (stage: number) => void }): JSX.Element {
  const s = useStore(heroState);
  const pt = useStore(party);
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(h);
  }, []);
  if (!s) return <Modal title={t('boss.title')} onClose={p.onClose}>{t('app.loading')}</Modal>;
  const now = Date.now() + serverOffset;
  const leader = !pt || pt.leader === pt.members.find((m) => m.heroId === s.hero.id)?.accountId;
  return (
    <Modal title={t('boss.title')} onClose={p.onClose} wide testid="bossboard">
      {s.bosses.map((b) => {
        const stage = b.chapter * 5;
        const unlocked = s.unlockedStages.includes(stage);
        const wait = b.readyAt !== null && b.readyAt > now ? b.readyAt - now : 0;
        return (
          <div class="boss-row">
            <div class="grow">
              <b>{b.name}</b>
              <small class="muted"> · {t('stageSelect.chapter', { n: b.chapter })}</small>
              <div class="row wrap small">
                <span class={b.defeated ? 'good' : ''}>{b.defeated ? t('boss.defeated') : t('boss.open')}</span>
                {b.defeated && <span>{wait > 0 ? t('boss.timer', { time: fmtTime(wait) }) : t('boss.ready')}</span>}
                {b.defeated && <span>{t('boss.battleLevel', { n: b.kampfstufe })}</span>}
              </div>
              <div class="row wrap small">
                {b.phases.map((ph, i) => (
                  <span>{i + 1}: <El el={ph.element} />{ph.weakTo && <> ↓<El el={ph.weakTo} /></>}</span>
                ))}
              </div>
            </div>
            <Btn small disabled={!unlocked || !leader || s.inRun} onClick={() => p.onFight(stage)}>{t('boss.fight')}</Btn>
          </div>
        );
      })}
    </Modal>
  );
}

