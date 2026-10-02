// Tavernentisch (14.2) und Bereit-Bildschirm (11.3): Party per Code oder Einladung, Stage-Wahl mit Empfehlung,
// Mitglieder mit Klasse, Stufe und Waffen-Element, Bereit, Start, Auto-Weiter (E-023), Online-Liste (11.1).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CHAPTER_COUNT, STAGES_PER_CHAPTER } from '@aethra/shared';
import type { PartyStateDTO } from '@aethra/shared';
import { content } from '../lib/content';
import { t } from '../lib/i18n';
import { net } from '../lib/net';
import { useStore } from '../lib/store';
import { heroState, invites, me, party, presence, serverOffset } from '../state';
import { Btn, ClassIcon, Confirm, El, Modal } from './common';

function stageLabel(s: number): string {
  return t('stageSelect.stage', { chapter: Math.ceil(s / STAGES_PER_CHAPTER), index: ((s - 1) % STAGES_PER_CHAPTER) + 1 });
}

export function StageSelect(p: { pt: PartyStateDTO | null; onPick: (stage: number) => void; onClose: () => void }): JSX.Element {
  const s = useStore(heroState);
  const c = content();
  const own = new Set(s?.unlockedStages ?? [1]);
  const choices = new Set(p.pt?.choices ?? [...own]);
  const cleared = new Map((s?.cleared ?? []).map((x) => [x.stage, x]));
  return (
    <Modal title={t('stageSelect.title')} onClose={p.onClose} wide testid="stage-select">
      {Array.from({ length: CHAPTER_COUNT }).map((_, ci) => {
        const ch = ci + 1;
        const boss = c.bosses.find((b) => b.chapter === ch);
        return (
          <section class="chapter">
            <h3>{t('stageSelect.chapter', { n: ch })} {boss && <El el={boss.element} />}</h3>
            <div class="stage-grid">
              {Array.from({ length: STAGES_PER_CHAPTER }).map((__, k) => {
                const st = ci * STAGES_PER_CHAPTER + k + 1;
                const def = c.stages[st - 1];
                const ok = choices.has(st);
                const isBoss = !!def?.boss;
                return (
                  <button type="button" class={`stage ${ok ? '' : 'locked'} ${isBoss ? 'boss' : ''} ${cleared.has(st) ? 'done' : ''}`} disabled={!ok}
                    onClick={() => p.onPick(st)} data-testid={`stage-${st}`}>
                    <b>{stageLabel(st)}</b>
                    <small>{isBoss ? c.bossById[def!.boss!].name.split(',')[0] : t('stageSelect.recommended', { level: def?.recommendedLevel ?? st })}</small>
                    {cleared.has(st) && <span class="check">✓</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Modal>
  );
}

/** Party-Leiste im Lager: Mitglieder, Stage, Bereit, Start. Ohne Party: Solo, Party erstellen, Beitreten. */
export function PartyPanel(p: { onStages: () => void }): JSX.Element {
  const pt = useStore(party);
  const s = useStore(heroState);
  const self = useStore(me);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(h);
  }, []);
  const c = content();
  if (!pt) {
    return (
      <section class="party-panel">
        <div class="row wrap">
          <Btn onClick={() => {
            net.send({ t: 'party.create' });
            p.onStages();
          }} testid="solo-start">{t('stageSelect.solo')}</Btn>
          <Btn kind="ghost" onClick={() => net.send({ t: 'party.create' })} testid="party-create">{t('party.create')}</Btn>
          <Btn kind="ghost" onClick={() => setJoining(true)} testid="party-join">{t('party.joinByCode')}</Btn>
        </div>
        {joining && (
          <Modal title={t('party.joinByCode')} onClose={() => setJoining(false)}>
            <input value={code} maxLength={c.engine.party.codeLength} placeholder="K7M2XQ" class="code-input"
              onInput={(e) => setCode(e.currentTarget.value.toUpperCase())} data-testid="party-code-input" />
            <div class="row end">
              <Btn onClick={() => {
                net.send({ t: 'party.join', code });
                setJoining(false);
              }} disabled={code.length !== c.engine.party.codeLength} testid="party-join-submit">{t('party.join')}</Btn>
            </div>
          </Modal>
        )}
      </section>
    );
  }
  const myAcc = self?.accountId ?? -1;
  const leader = pt.leader === myAcc;
  const mine = pt.members.find((m) => m.accountId === myAcc);
  const def = pt.stage !== null ? c.stages[pt.stage - 1] : null;
  const startsIn = pt.startsAt !== null ? Math.max(0, pt.startsAt - (Date.now() + serverOffset)) : null;
  const allReady = pt.members.filter((m) => m.connected).every((m) => m.ready);
  const solo = pt.members.length === 1;
  const lowLevel = def && s ? s.hero.level < def.recommendedLevel : false;
  return (
    <section class="party-panel" data-testid="party-panel">
      <div class="row between">
        <span>{solo ? t('party.solo') : t('party.title')} · {t('party.code')}: <b class="code" data-testid="party-code">{pt.code}</b></span>
        <Btn small kind="ghost" onClick={() => net.send({ t: 'party.leave' })}>{t('party.leave')}</Btn>
      </div>
      <ul class="members">
        {pt.members.map((m) => (
          <li class={`${m.connected ? '' : 'off'} ${m.allowed || !def ? '' : 'blocked'}`}>
            {m.classId && <ClassIcon cls={m.classId} />}
            <b>{m.heroName ?? m.username}</b>
            <small>{m.level !== null ? `${t('hero.level')} ${m.level}` : ''}</small>
            <El el={m.element} />
            {m.accountId === pt.leader && <span title={t('party.leader')}>👑</span>}
            {m.helper && <span class="tag" title={t('boss.helper')}>{t('party.helperTag')}</span>}
            {def && !m.allowed && <span class="tag bad">{t('party.notAllowed')}</span>}
            {m.inRun && <span class="tag">{t('party.inRun')}</span>}
            {m.rejoin && <span class="tag">{t('party.rejoining')}</span>}
            <span class={`ready ${m.ready ? 'on' : ''}`}>{m.ready ? '✔' : '…'}</span>
            {leader && m.accountId !== myAcc && (
              <button type="button" class="x" onClick={() => net.send({ t: 'party.kick', targetAccountId: m.accountId })} aria-label={t('party.kick')}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {pt.inRun ? (
        <div class="row wrap">
          <span>{t('party.runActive')}</span>
          {mine && !mine.inRun && <Btn small onClick={() => net.send({ t: 'run.rejoin', on: !mine.rejoin })}>{mine.rejoin ? t('party.cancelRejoin') : t('party.rejoin')}</Btn>}
        </div>
      ) : (
        <>
          <div class="row wrap between">
            <span>
              {def ? <>{stageLabel(def.stage)} · {def.boss ? c.bossById[def.boss].name : t('stageSelect.recommended', { level: def.recommendedLevel })}</> : t('party.noStage')}
            </span>
            {leader && <Btn small kind="ghost" onClick={p.onStages} testid="party-stage">{t('stageSelect.title')}</Btn>}
          </div>
          {lowLevel && def && <div class="warn">{t('stageSelect.levelWarning', { level: def.recommendedLevel })}</div>}
          {def?.boss && mine?.helper && <div class="warn">{t('boss.helper')}</div>}
          <div class="row wrap">
            {!solo && (
              <Btn kind={mine?.ready ? 'ghost' : 'primary'} onClick={() => net.send({ t: 'party.ready', ready: !mine?.ready })} testid="party-ready">
                {mine?.ready ? t('party.notReady') : t('party.ready')}
              </Btn>
            )}
            {leader && (
              <Btn kind="gold" disabled={!def || startsIn !== null} onClick={() => (allReady || solo ? net.send({ t: 'party.start' }) : setConfirmStart(true))} testid="party-start">
                {startsIn !== null ? `${Math.ceil(startsIn / 1000)} …` : t('stageSelect.start')}
              </Btn>
            )}
            {leader && (
              <label class="switch">
                <input type="checkbox" checked={pt.autoContinue} onChange={(e) => net.send({ t: 'party.autoContinue', on: e.currentTarget.checked })} />
                {t('party.autoContinue')}
              </label>
            )}
          </div>
        </>
      )}
      {confirmStart && <Confirm text={t('stageSelect.notAllReady')} onNo={() => setConfirmStart(false)} onYes={() => {
        setConfirmStart(false);
        net.send({ t: 'party.start' });
      }} />}
    </section>
  );
}

/** Online-Liste mit Einladen (11.1). */
export function OnlineList(p: { onClose: () => void }): JSX.Element {
  const list = useStore(presence);
  const self = useStore(me);
  const pt = useStore(party);
  const inParty = new Set(pt?.members.map((m) => m.accountId) ?? []);
  return (
    <Modal title={`${t('camp.online')} (${list.length})`} onClose={p.onClose} testid="online">
      <ul class="online">
        {list.map((e) => (
          <li>
            {e.classId && <ClassIcon cls={e.classId} />}
            <span class="grow"><b>{e.heroName ?? e.username}</b> <small class="muted">{e.username}{e.level !== null ? ` · ${t('hero.level')} ${e.level}` : ''}</small><br />
              <small>{e.status === 'stage' ? t('camp.inStage', { stage: stageLabel(e.stage ?? 1) }) : e.status === 'boss' ? t('camp.inBoss') : e.status === 'abwesend' ? t('camp.away') : t('camp.inCamp')}</small>
            </span>
            {e.accountId !== self?.accountId && !inParty.has(e.accountId) && (
              <Btn small onClick={() => net.send({ t: 'party.invite', targetAccountId: e.accountId })}>{t('party.invite')}</Btn>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Einladungen als Hinweis mit Annehmen und Ablehnen (11.1). */
export function InviteToasts(): JSX.Element {
  const list = useStore(invites);
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => {
      const now = Date.now();
      if (invites.get().some((x) => x.expiresAt <= now)) invites.set((l) => l.filter((x) => x.expiresAt > now));
      tick((x) => x + 1);
    }, 1000);
    return () => clearInterval(h);
  }, []);
  const answer = (id: string, accept: boolean) => {
    net.send({ t: 'party.answer', inviteId: id, accept });
    invites.set((l) => l.filter((x) => x.inviteId !== id));
  };
  return (
    <div class="invites">
      {list.map((i) => (
        <div class="invite" data-testid="invite">
          <span>{t('party.invited', { name: i.from })} <small>({Math.ceil((i.expiresAt - Date.now()) / 1000)} s)</small></span>
          <Btn small onClick={() => answer(i.inviteId, true)}>{t('party.accept')}</Btn>
          <Btn small kind="ghost" onClick={() => answer(i.inviteId, false)}>{t('party.decline')}</Btn>
        </div>
      ))}
    </div>
  );
}
