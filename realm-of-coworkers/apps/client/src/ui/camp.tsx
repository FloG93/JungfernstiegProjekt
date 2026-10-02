// Lager (3.3, 14.1): Laterne und Lagerfeuer, 5 Stationen als Fenster, Party-Leiste, Online-Liste, Chat.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { content } from '../lib/content';
import { t } from '../lib/i18n';
import { net } from '../lib/net';
import { useStore } from '../lib/store';
import { chat, heroState, heroes, party, presence, screen } from '../state';
import { Bar, Btn, Gold, Modal } from './common';
import { Equipment } from './equipment';
import { HeroPortrait } from './heroes';
import { InviteToasts, OnlineList, PartyPanel, StageSelect } from './party';
import { SettingsView } from './settings';
import { Archive, BossBoard, Jeweler, Smith } from './stations';

type Win = 'equip' | 'smith' | 'jeweler' | 'archive' | 'bosses' | 'stages' | 'online' | 'settings' | 'chat' | null;

export function ChatBox(p: { compact?: boolean }): JSX.Element {
  const lines = useStore(chat);
  const pt = useStore(party);
  const [text, setText] = useState('');
  const c = content();
  const quick = Array.from({ length: c.engine.party.quickMessages }, (_, i) => t(`chat.quick${i + 1}`));
  const send = (s: string) => {
    if (!s.trim()) return;
    net.send({ t: 'party.chat', text: s.trim().slice(0, c.balance.session.chatMaxLen) });
    setText('');
  };
  return (
    <div class={`chat ${p.compact ? 'compact' : ''}`}>
      <div class="chat-lines" aria-live="polite" data-testid="chat-lines">
        {lines.slice(-30).map((l) => <p><b>{l.name}:</b> {l.text}</p>)}
        {!pt && <p class="muted">{t('chat.needParty')}</p>}
      </div>
      {pt && (
        <>
          <div class="quick">{quick.map((q) => <button type="button" onClick={() => send(q)}>{q}</button>)}</div>
          <form class="row" onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}>
            <input value={text} maxLength={c.balance.session.chatMaxLen} placeholder={t('chat.placeholder')} onInput={(e) => setText(e.currentTarget.value)} data-testid="chat-input" />
            <button type="submit" class="btn small">➤</button>
          </form>
        </>
      )}
    </div>
  );
}

export function Camp(): JSX.Element {
  const s = useStore(heroState);
  const online = useStore(presence);
  const pt = useStore(party);
  const [win, setWin] = useState<Win>(null);
  const status = useStore(net.status);
  if (!s) return <div class="screen center">{t('app.loading')}</div>;
  const h = s.hero;
  const close = () => setWin(null);
  const pickStage = (stage: number) => {
    if (!party.get()) net.send({ t: 'party.create' });
    net.send({ t: 'party.setStage', stage });
    if (!party.get() || party.get()!.members.length === 1) net.send({ t: 'party.start' });
    close();
  };
  const stations: { id: Exclude<Win, null>; icon: string; label: string; who?: string }[] = [
    { id: 'equip', icon: '🎒', label: t('camp.equipment') },
    { id: 'smith', icon: '⚒', label: t('camp.smith'), who: 'Torbek' },
    { id: 'jeweler', icon: '💎', label: t('camp.jeweler'), who: 'Ysolde' },
    { id: 'archive', icon: '📜', label: t('camp.archive'), who: 'Nerith' },
    { id: 'bosses', icon: '🐉', label: t('camp.bossBoard') },
    { id: 'stages', icon: '🗺', label: t('camp.table'), who: 'Marla' },
  ];
  return (
    <div class="screen camp">
      <header class="hero-head">
        <HeroPortrait cls={h.classId} look={h.appearance} size={48} />
        <div class="grow">
          <b data-testid="hero-name-display">{h.name}</b> <small class="muted">{t(`class.${h.classId}`)} · {t('hero.level')} {h.level}</small>
          <Bar value={h.xp} max={h.xpToNext || 1} color="#a07cff" label={h.xpToNext ? `${t('loot.xp')} ${h.xp} / ${h.xpToNext}` : t('hero.maxLevel')} />
        </div>
        <div class="col end">
          <span data-testid="gold"><Gold n={h.gold} /></span>
          <small>✧ {h.splinters}</small>
        </div>
      </header>
      {status.state !== 'online' && <div class="warn">{status.state === 'replaced' ? t('error.replaced') : t('error.connectionPoor')}</div>}
      <div class="campfire" aria-hidden="true"><div class="flame" /><div class="lantern">🏮</div></div>
      <nav class="stations">
        {stations.map((st) => (
          <button type="button" class="station" onClick={() => setWin(st.id)} data-testid={`station-${st.id}`}>
            <span class="ico">{st.icon}</span>
            <b>{st.label}</b>
            {st.who && <small>{st.who}</small>}
          </button>
        ))}
      </nav>
      <PartyPanel onStages={() => setWin('stages')} />
      <footer class="camp-foot">
        <Btn kind="ghost" small onClick={() => setWin('online')} testid="online-open">👥 {t('camp.online')} ({online.length})</Btn>
        <Btn kind="ghost" small onClick={() => setWin('chat')} testid="chat-open">💬 {t('chat.title')}</Btn>
        <Btn kind="ghost" small onClick={() => setWin('settings')} testid="settings-open">⚙ {t('settings.title')}</Btn>
        {heroes.get().length > 0 && !pt?.inRun && <Btn kind="ghost" small onClick={() => screen.set('heroes')}>⇄ {t('hero.select')}</Btn>}
      </footer>
      <InviteToasts />
      {win === 'equip' && <Equipment onClose={close} />}
      {win === 'smith' && <Smith onClose={close} />}
      {win === 'jeweler' && <Jeweler onClose={close} />}
      {win === 'archive' && <Archive onClose={close} />}
      {win === 'bosses' && <BossBoard onClose={close} onFight={pickStage} />}
      {win === 'stages' && <StageSelect pt={pt} onPick={pickStage} onClose={close} />}
      {win === 'online' && <OnlineList onClose={close} />}
      {win === 'settings' && <SettingsView onClose={close} />}
      {win === 'chat' && <Modal title={t('chat.title')} onClose={close} testid="chat"><ChatBox /></Modal>}
    </div>
  );
}
