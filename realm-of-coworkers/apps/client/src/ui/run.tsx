// Stage und Bosskampf (14.3, 14.4, E-022): Spielszene, Party-Leiste, Stage- bzw. Boss-Leiste, Stick und große
// Fähigkeitstasten (langes Drücken schaltet Auto-Cast), Trank, Rolle, Waffenwechsel, Bereit-Bildschirm am Boss-Tor.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { BossId, SkillDef } from '@aethra/shared';
import { play, unlockAudio } from '../lib/audio';
import { content } from '../lib/content';
import { fmt, fmtTime, t } from '../lib/i18n';
import { net } from '../lib/net';
import { settings } from '../lib/settings';
import { useStore } from '../lib/store';
import type { GameHost } from '../game/host';
import { banners, controls, currentView, drainEvents, hud, party, toast } from '../state';
import type { RunHud } from '../state';
import { Bar, Btn, ClassIcon, El, closeTopModal } from './common';
import { ChatBox } from './camp';
import { SettingsView } from './settings';

const LONG_PRESS_MS = 450;
const TAP_MS = 280;
const TAP_MOVE_PX = 14;
const STICK_RADIUS = 56;
const POOR_RTT_MS = 800;

// ---------- Stick ----------

function Joystick(): JSX.Element {
  const [knob, setKnob] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const down = (e: PointerEvent) => {
    unlockAudio();
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = ref.current!.getBoundingClientRect();
    setKnob({ ox: e.clientX - r.left, oy: e.clientY - r.top, x: 0, y: 0 });
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pid.current || !knob) return;
    const r = ref.current!.getBoundingClientRect();
    let dx = e.clientX - r.left - knob.ox;
    let dy = e.clientY - r.top - knob.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    setKnob({ ...knob, x: dx, y: dy });
    controls.setStick(dx / STICK_RADIUS, dy / STICK_RADIUS);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    setKnob(null);
    controls.setStick(0, 0);
  };
  return (
    <div class="stick-zone" ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={t('hud.stick')}>
      {knob ? (
        <div class="stick" style={{ left: `${knob.ox}px`, top: `${knob.oy}px` }}>
          <div class="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : <div class="stick-hint">{t('hud.stick')}</div>}
    </div>
  );
}

// ---------- Fähigkeiten ----------

function skillName(id: string): string {
  return t(`skill.${id}`);
}

function SkillButton(p: { def: SkillDef; h: NonNullable<RunHud['me']>; big?: boolean; keyLabel: string }): JSX.Element {
  const { def, h } = p;
  const cd = h.cd[def.id] ?? 0;
  const total = def.cooldownS * 1000;
  const locked = h.level < def.unlockLevel;
  const auto = h.autocast[def.id] ?? false;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  const toggleAuto = () => {
    net.send({ t: 'run.autocast', skillId: def.id, on: !auto });
    toast(`${skillName(def.id)}: ${t('hud.autoCast')} ${!auto ? t('hud.on') : t('hud.off')}`, 'info', 1500);
    play('click');
  };
  const down = () => {
    unlockAudio();
    long.current = false;
    timer.current = setTimeout(() => {
      long.current = true;
      toggleAuto();
    }, LONG_PRESS_MS);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!long.current && !locked) controls.act({ k: 'skill', id: def.id });
  };
  const deg = cd > 0 && total > 0 ? Math.round((cd / total) * 360) : 0;
  return (
    <button type="button" class={`skill ${p.big ? 'big' : ''} ${locked ? 'locked' : ''} ${cd > 0 ? 'cooling' : ''}`}
      onPointerDown={down} onPointerUp={up} onPointerLeave={() => timer.current && clearTimeout(timer.current)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        long.current = true;
        toggleAuto();
      }}
      aria-label={`${skillName(def.id)}${auto ? `, ${t('hud.autoCast')}` : ''}`} data-testid={`skill-${def.slot}`}>
      <span class="cd" style={{ background: deg > 0 ? `conic-gradient(rgba(0,0,0,.65) ${deg}deg, transparent 0)` : 'none' }} />
      <span class="sname">{skillName(def.id)}</span>
      {cd > 0 && <span class="secs">{fmt(cd / 1000, cd < 10_000 ? 1 : 0)}</span>}
      {locked && <span class="secs">🔒{def.unlockLevel}</span>}
      {auto && <span class="auto">AUTO</span>}
      <span class="key">{p.keyLabel}</span>
    </button>
  );
}

function ActionButton(p: { label: string; icon: string; cd?: number; badge?: string | number; disabled?: boolean; blink?: boolean; onPress: () => void; testid?: string; keyLabel?: string }): JSX.Element {
  return (
    <button type="button" class={`skill small ${p.disabled ? 'locked' : ''} ${p.blink ? 'blink' : ''}`} disabled={p.disabled}
      onPointerDown={() => {
        unlockAudio();
        p.onPress();
      }} aria-label={p.label} data-testid={p.testid}>
      <span class="ico">{p.icon}</span>
      {p.cd !== undefined && p.cd > 0 && <span class="secs">{fmt(p.cd / 1000, 0)}</span>}
      {p.badge !== undefined && <span class="badge">{p.badge}</span>}
      {p.keyLabel && <span class="key">{p.keyLabel}</span>}
    </button>
  );
}

function SkillBar(p: { h: RunHud }): JSX.Element | null {
  const me = p.h.me;
  if (!me) return null;
  const c = content();
  const defs = c.classById[me.cls].skills.map((id) => c.skillById.get(id)).filter((d): d is SkillDef => !!d);
  const by = (slot: SkillDef['slot']) => defs.find((d) => d.slot === slot);
  const boss = p.h.boss;
  const weak = boss ? c.elementById[boss.el].weakTo : null;
  const other = me.activeSet === 'A' ? me.setElements.B : me.setElements.A;
  const swapBlink = !!weak && me.el !== weak && other === weak;
  const roll = () => {
    controls.act({ k: 'roll' });
    currentView()?.predictRoll(performance.now(), controls.dir);
  };
  const s1 = by('s1');
  const s2 = by('s2');
  const s3 = by('s3');
  const ult = by('ult');
  return (
    <div class="skillbar">
      <div class="small-row">
        <ActionButton label={t('hud.potion')} icon="🧪" cd={me.potionCd} badge={me.potions} disabled={me.potions <= 0} onPress={() => controls.act({ k: 'potion' })} testid="act-potion" keyLabel="F" />
        <ActionButton label={t('hud.roll')} icon="💨" cd={me.rollCd} onPress={roll} testid="act-roll" keyLabel="␣" />
        <ActionButton label={t('hud.swapWeapon')} icon={me.activeSet} cd={me.swapCd} disabled={me.setElements.B === null} blink={swapBlink}
          badge={me.activeSet === 'A' ? (me.setElements.B ? '→B' : '') : '→A'} onPress={() => controls.act({ k: 'swap' })} testid="act-swap" keyLabel="Q" />
      </div>
      <div class="main-skills">
        {s1 && <SkillButton def={s1} h={me} keyLabel="1" />}
        {s2 && <SkillButton def={s2} h={me} keyLabel="2" />}
        {s3 && <SkillButton def={s3} h={me} keyLabel="3" />}
        {ult && <SkillButton def={ult} h={me} big keyLabel="R" />}
      </div>
    </div>
  );
}

// ---------- Leisten oben ----------

function PartyFrames(p: { h: RunHud }): JSX.Element {
  return (
    <div class="frames">
      {p.h.frames.map((f) => (
        <button type="button" class={`frame ${f.own ? 'own' : ''} ${f.dead ? 'dead' : ''}`}
          onClick={() => f.dead && !f.own && controls.act({ k: 'revive', targetId: f.id })} aria-label={f.dead ? `${t('hud.revive')}: ${f.name}` : f.name}>
          <ClassIcon cls={f.cls} />
          <span class="fname">{f.name}</span>
          <Bar value={f.hp} max={f.maxHp} shield={f.shield} color={f.own ? '#5ee07a' : '#4cb8ff'} />
          {f.dead && !f.own && <span class="revive-hint">✚</span>}
          <span class="fx">{f.fx.slice(0, 8).map((x) => <i title={t(`status.${x.id}`)} class={`fxdot fx-${x.id}`} />)}</span>
        </button>
      ))}
    </div>
  );
}

function StageProgress(p: { h: RunHud }): JSX.Element {
  const r = p.h.run;
  const def = content().stages[p.h.stage - 1];
  const len = def?.lengthPx ?? r.worldWidth;
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / len) * 100))}%`;
  return (
    <div class="stagebar" aria-label={t('hud.stageProgress')}>
      <div class="track">
        <div class="done" style={{ width: pct(r.anchorX) }} />
        {def?.encounters.map((e, i) => <i class={`enc ${i < r.encounter || (r.encounter === -1 && e.x < r.anchorX) ? 'past' : ''}`} style={{ left: pct(e.x) }} />)}
        {def?.checkpoints.map((x) => <i class="cp" style={{ left: pct(x) }} />)}
        <i class="anchor" style={{ left: pct(r.anchorX) }} />
      </div>
      <small>
        {t('stageSelect.stage', { chapter: Math.ceil(p.h.stage / 5), index: ((p.h.stage - 1) % 5) + 1 })}
        {r.encounter >= 0 && <> · {t('hud.encounter', { n: r.encounter + 1, total: r.encounters })}</>}
        {r.wipes > 0 && <> · ☠ {r.wipes}</>}
      </small>
    </div>
  );
}

function BossBar(p: { h: RunHud }): JSX.Element | null {
  const b = p.h.boss;
  if (!b) return null;
  const c = content();
  const def = c.bossById[b.bossId];
  const weak = c.elementById[b.el].weakTo;
  const r = p.h.run;
  return (
    <div class={`bossbar el-border-${b.el}`} data-testid="bossbar">
      <div class="row">
        <El el={b.el} />
        <b class="grow">{def.name}</b>
        {weak && <span class="weak" title={t('boss.weakTo')}>{t('boss.weakTo')} <El el={weak} /></span>}
      </div>
      <Bar value={b.hp} max={b.maxHp} shield={b.shield} color="#e5484d" marks={[66, 33]} label={`${fmt(b.hp)} / ${fmt(b.maxHp)}`} />
      <small class="row">
        <span>{t('boss.phase', { n: r.bossPhase, element: t(`element.${b.el}`) })}</span>
        {r.kampfstufe > 0 && <span>{t('boss.battleLevel', { n: r.kampfstufe })}</span>}
        {r.enrageIn !== null && <span>{t('boss.enrage', { time: fmtTime(r.enrageIn) })}</span>}
        <span class="fx">{b.fx.slice(0, 8).map((x) => <i title={t(`status.${x.id}`)} class={`fxdot fx-${x.id}`} />)}</span>
      </small>
    </div>
  );
}

// ---------- Overlays ----------

function GateDialog(p: { h: RunHud }): JSX.Element | null {
  const r = p.h.run;
  if (r.phase !== 'gate') return null;
  const c = content();
  const bossId = r.bossId as BossId | null;
  const def = bossId ? c.bossById[bossId] : null;
  const view = currentView();
  const roster = view?.start.roster ?? [];
  const meAcc = p.h.frames.find((f) => f.own)?.acc;
  const ready = new Set(r.ready);
  return (
    <div class="overlay gate" data-testid="gate">
      <div class="panel">
        <h2>{def?.name}</h2>
        <div class="row wrap">
          {def?.phases.map((ph, i) => <span>{t('boss.phase', { n: i + 1, element: '' })}<El el={ph.element} /></span>)}
        </div>
        {r.kampfstufe > 0 && <p>{t('boss.battleLevel', { n: r.kampfstufe })}</p>}
        <ul class="members">
          {roster.map((m) => (
            <li>
              <ClassIcon cls={m.classId} /> <b>{m.name}</b>
              {m.helper && <span class="tag">{t('party.helperTag')}</span>}
              <span class={`ready ${ready.has(m.accountId) ? 'on' : ''}`}>{ready.has(m.accountId) ? '✔' : '…'}</span>
            </li>
          ))}
        </ul>
        {p.h.me?.helper && <p class="warn">{t('boss.helper')}</p>}
        {r.autoReadyIn !== null && <p class="muted">{t('hud.autoReady', { s: Math.ceil(r.autoReadyIn / 1000) })}</p>}
        <div class="row end">
          <Btn kind="ghost" onClick={() => net.send({ t: 'run.leave' })}>{t('hud.leave')}</Btn>
          <Btn kind="gold" disabled={meAcc !== undefined && meAcc !== null && ready.has(meAcc)} onClick={() => net.send({ t: 'run.ready' })} testid="gate-ready">{t('boss.ready')}</Btn>
        </div>
      </div>
    </div>
  );
}

function Countdown(p: { h: RunHud }): JSX.Element | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((x) => x + 1), 200);
    return () => clearInterval(h);
  }, []);
  if (p.h.run.phase !== 'countdown' || p.h.countdownAt === null) return null;
  const s = Math.max(0, Math.ceil((p.h.countdownAt - performance.now()) / 1000));
  return <div class="overlay countdown"><span>{s}</span><small>{t('hud.swapHint')}</small></div>;
}

function Banners(): JSX.Element {
  const list = useStore(banners);
  return (
    <div class="banners" aria-live="assertive">
      {list.map((b) => <div class={`banner ${b.kind}`}><b>{b.text}</b>{b.sub && <small>{b.sub}</small>}</div>)}
    </div>
  );
}

function ConnectionOverlay(): JSX.Element | null {
  const st = useStore(net.status);
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(h);
  }, []);
  if (st.state !== 'lost' && st.state !== 'replaced' && st.state !== 'outdated') return null;
  if (st.state === 'outdated') {
    return <div class="overlay"><div class="panel"><p>{t('error.versionMismatch')}</p><Btn onClick={() => location.reload()}>{t('app.reload')}</Btn></div></div>;
  }
  if (st.state === 'replaced') {
    return <div class="overlay"><div class="panel"><p>{t('error.replaced')}</p><Btn onClick={() => net.retryNow()}>{t('app.retry')}</Btn></div></div>;
  }
  const grace = content().balance.net.disconnectGraceS * 1000;
  const left = st.lostAt !== null ? Math.max(0, grace - (Date.now() - st.lostAt)) : grace;
  const retry = st.retryAt !== null ? Math.max(0, Math.ceil((st.retryAt - Date.now()) / 1000)) : 0;
  return (
    <div class="overlay conn" data-testid="conn-lost">
      <div class="panel">
        <p>{t('error.connectionLost', { seconds: retry })}</p>
        <p class="muted">{t('hud.autopilotLeft', { s: Math.ceil(left / 1000) })}</p>
        <Btn onClick={() => net.retryNow()}>{t('app.retry')}</Btn>
      </div>
    </div>
  );
}

function Menu(p: { h: RunHud; onClose: () => void; onSettings: () => void }): JSX.Element {
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class="panel menu">
        <h2>{t('hud.menu')}</h2>
        {p.h.solo && <Btn onClick={() => {
          net.send({ t: 'run.pause', on: !p.h.run.paused });
          p.onClose();
        }}>{p.h.run.paused ? t('hud.resume') : t('hud.pause')}</Btn>}
        <Btn kind="ghost" onClick={p.onSettings}>{t('settings.title')}</Btn>
        <Btn kind="danger" onClick={() => {
          net.send({ t: 'run.leave' });
          p.onClose();
        }} testid="run-leave">{t('hud.leave')}</Btn>
        <Btn kind="ghost" onClick={p.onClose}>{t('app.close')}</Btn>
      </div>
    </div>
  );
}

function PingMenu(p: { at: { x: number; y: number; wx: number; wy: number }; onClose: () => void }): JSX.Element {
  const send = (kind: 'hint' | 'danger' | 'help') => {
    net.send({ t: 'run.ping', kind, x: p.at.wx, y: p.at.wy });
    p.onClose();
  };
  return (
    <div class="ping-menu" style={{ left: `${p.at.x}px`, top: `${p.at.y}px` }}>
      <button type="button" onClick={() => send('hint')}>◆ {t('ping.hint')}</button>
      <button type="button" onClick={() => send('danger')}>⚠ {t('ping.danger')}</button>
      <button type="button" onClick={() => send('help')}>✋ {t('ping.help')}</button>
      <button type="button" class="x" onClick={p.onClose}>✕</button>
    </div>
  );
}

// ---------- Tastatur (14.7) ----------

function useKeyboard(h: () => RunHud | null, openMenu: () => void, openChat: () => void): void {
  useEffect(() => {
    const k = () => settings.get().keys;
    const axisOf = (code: string): 'up' | 'down' | 'left' | 'right' | null => {
      const keys = k();
      if (code === keys['up'] || code === 'ArrowUp') return 'up';
      if (code === keys['down'] || code === 'ArrowDown') return 'down';
      if (code === keys['left'] || code === 'ArrowLeft') return 'left';
      if (code === keys['right'] || code === 'ArrowRight') return 'right';
      return null;
    };
    const skillOf = (slot: string) => {
      const me = h()?.me;
      if (!me) return null;
      const c = content();
      return c.classById[me.cls].skills.map((id) => c.skillById.get(id)).find((d) => d?.slot === slot) ?? null;
    };
    const quickDown = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (e.altKey && n >= 1 && n <= 5) {
        net.send({ t: 'party.chat', text: t(`chat.quick${n}`) });
        return true;
      }
      return false;
    };
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      unlockAudio();
      if (quickDown(e)) {
        e.preventDefault();
        return;
      }
      const ax = axisOf(e.code);
      if (ax) {
        e.preventDefault();
        if (!e.repeat) controls.keyDown(ax);
        return;
      }
      if (e.repeat) return;
      const keys = k();
      const hd = h();
      switch (e.code) {
        case keys['roll']:
          e.preventDefault();
          controls.act({ k: 'roll' });
          currentView()?.predictRoll(performance.now(), controls.dir);
          return;
        case keys['s1']:
        case keys['s2']:
        case keys['s3']:
        case keys['ult']: {
          const slot = e.code === keys['s1'] ? 's1' : e.code === keys['s2'] ? 's2' : e.code === keys['s3'] ? 's3' : 'ult';
          const d = skillOf(slot);
          if (d) controls.act({ k: 'skill', id: d.id });
          return;
        }
        case keys['potion']:
          controls.act({ k: 'potion' });
          return;
        case keys['swap']:
          controls.act({ k: 'swap' });
          return;
        case keys['target']: {
          e.preventDefault();
          const v = currentView();
          const own = v?.own();
          if (!v || !own) return;
          const foes = [...v.ents.values()].filter((x) => x.kind !== 'hero' && x.removedAt === null && x.cur.state !== 'dead')
            .sort((a, b) => Math.abs(a.cur.x - own.cur.x) - Math.abs(b.cur.x - own.cur.x));
          const cur = hd?.me?.focusId ?? null;
          const i = foes.findIndex((x) => x.id === cur);
          const next = foes[(i + 1) % Math.max(1, foes.length)];
          if (next) controls.act({ k: 'focus', targetId: next.id });
          return;
        }
        case keys['autowalk']:
          if (hd?.leader) net.send({ t: 'run.autowalk', on: !hd.run.autowalk });
          return;
        case keys['pause']:
          if (hd?.solo) net.send({ t: 'run.pause', on: !hd.run.paused });
          return;
        case keys['chat']:
          e.preventDefault();
          openChat();
          return;
        case 'Escape':
          if (!closeTopModal()) openMenu();
          return;
        default:
          return;
      }
    };
    const up = (e: KeyboardEvent) => {
      const ax = axisOf(e.code);
      if (ax) controls.keyUp(ax);
    };
    const blur = () => controls.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}

// ---------- Bildschirm ----------

export function RunScreen(): JSX.Element {
  const h = useStore(hud);
  const pt = useStore(party);
  const st = useStore(net.status);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<GameHost | null>(null);
  const [menu, setMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ping, setPing] = useState<{ x: number; y: number; wx: number; wy: number } | null>(null);
  const press = useRef<{ x: number; y: number; at: number; timer: ReturnType<typeof setTimeout> | null; id: number } | null>(null);
  const hudRef = useRef(h);
  hudRef.current = h;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let gone = false;
    // Phaser wird erst für den Run geladen (Erstladen klein halten, 2.7)
    void import('../game/host').then(({ GameHost: Host }) => {
      if (gone) return;
      hostRef.current = new Host(el, {
        content: content(), view: currentView, settings: () => settings.get(), ownDir: () => controls.dir, drainEvents,
      });
    });
    return () => {
      gone = true;
      hostRef.current?.destroy();
      hostRef.current = null;
      controls.releaseAll();
    };
  }, []);
  useKeyboard(() => hudRef.current, () => setMenu(true), () => setChatOpen(true));

  const toWorld = (e: PointerEvent) => {
    const scene = hostRef.current?.scene;
    const r = stageRef.current?.getBoundingClientRect();
    if (!scene || !r) return null;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: scene.screenToWorld(e.clientX - r.left, e.clientY - r.top) };
  };
  const down = (e: PointerEvent) => {
    unlockAudio();
    const p = toWorld(e);
    if (!p) return;
    const timer = setTimeout(() => {
      setPing({ x: p.x, y: p.y, wx: p.w.x, wy: p.w.y });
      press.current = null;
    }, LONG_PRESS_MS * 1.3);
    press.current = { x: e.clientX, y: e.clientY, at: performance.now(), timer, id: e.pointerId };
  };
  const up = (e: PointerEvent) => {
    const pr = press.current;
    press.current = null;
    if (!pr || pr.id !== e.pointerId) return;
    if (pr.timer) clearTimeout(pr.timer);
    if (performance.now() - pr.at > TAP_MS * 2 || Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > TAP_MOVE_PX) return;
    const p = toWorld(e);
    const scene = hostRef.current?.scene;
    if (!p || !scene) return;
    const foe = scene.enemyAt(p.w);
    if (foe !== null) {
      controls.act({ k: 'focus', targetId: foe });
      play('click');
    } else if (p.w.y >= -20 && p.w.y <= content().engine.world.bandDepthPx + 20) {
      controls.moveTo(p.w.x, Math.max(0, Math.min(content().engine.world.bandDepthPx, p.w.y)));
    }
  };
  const cancel = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  };

  const poor = (st.rtt ?? 0) > POOR_RTT_MS;
  const leader = !!h?.leader;
  return (
    <div class={`screen run ${h?.run.arena ? 'arena' : ''}`} data-testid="run">
      <div class="stage-area" ref={stageRef}>
        <div class="touch-layer" onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()} />
      </div>
      <div class="hud">
        <div class="hud-top">
          {h && <PartyFrames h={h} />}
          <div class="hud-center">
            {h && !h.run.arena && <StageProgress h={h} />}
            {h && h.run.arena && <BossBar h={h} />}
          </div>
          <div class="hud-buttons">
            {poor && <span class="poor" title={t('error.connectionPoor')}>📶</span>}
            {leader && h && !h.run.arena && (
              <button type="button" class={`hbtn ${h.run.autowalk ? 'on' : ''}`} onClick={() => net.send({ t: 'run.autowalk', on: !h.run.autowalk })} aria-label={t('hud.autowalk')} data-testid="autowalk">🚶</button>
            )}
            {h?.solo && <button type="button" class="hbtn" onClick={() => net.send({ t: 'run.pause', on: !h.run.paused })} aria-label={t('hud.pause')}>{h.run.paused ? '▶' : '⏸'}</button>}
            {pt && pt.members.length > 1 && <button type="button" class="hbtn" onClick={() => setChatOpen(!chatOpen)} aria-label={t('chat.title')}>💬</button>}
            <button type="button" class="hbtn" onClick={() => setMenu(true)} aria-label={t('hud.menu')} data-testid="run-menu">☰</button>
          </div>
        </div>
        <div class="hud-bottom">
          <Joystick />
          {h && <SkillBar h={h} />}
        </div>
      </div>
      <Banners />
      {h && <Countdown h={h} />}
      {h && <GateDialog h={h} />}
      {h?.run.paused && <div class="overlay paused"><div class="panel"><h2>{t('hud.paused')}</h2><Btn onClick={() => net.send({ t: 'run.pause', on: false })}>{t('hud.resume')}</Btn></div></div>}
      {h?.me?.autopilot && <div class="autopilot-tag">{t('hud.autopilot')}</div>}
      {h?.me?.dead && <div class="dead-tag">{t('hud.dead')}</div>}
      {chatOpen && <div class="chat-float"><ChatBox compact /></div>}
      {ping && <PingMenu at={ping} onClose={() => setPing(null)} />}
      {menu && h && <Menu h={h} onClose={() => setMenu(false)} onSettings={() => {
        setMenu(false);
        setSettingsOpen(true);
      }} />}
      {settingsOpen && <SettingsView onClose={() => setSettingsOpen(false)} />}
      <ConnectionOverlay />
      {!h && <div class="overlay"><div class="panel">{t('app.loading')}</div></div>}
    </div>
  );
}
