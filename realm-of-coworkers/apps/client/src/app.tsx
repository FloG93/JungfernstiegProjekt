// Wurzel der Oberfläche (14.1): Bildschirmwechsel, Hinweise, Story, globale Tasten.
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { unlockAudio } from './lib/audio';
import { t } from './lib/i18n';
import { useStore } from './lib/store';
import { boot, screen, toasts } from './state';
import { Camp } from './ui/camp';
import { closeTopModal } from './ui/common';
import { HeroSelect } from './ui/heroes';
import { Login } from './ui/login';
import { LootScreen } from './ui/loot';
import { RunScreen } from './ui/run';
import { StoryOverlay } from './ui/story';

function Toasts(): JSX.Element {
  const list = useStore(toasts);
  return (
    <div class="toasts" aria-live="polite">
      {list.map((x) => <div class={`toast ${x.kind}`} role={x.kind === 'error' ? 'alert' : 'status'}>{x.text}</div>)}
    </div>
  );
}

export function App(): JSX.Element {
  const sc = useStore(screen);
  useEffect(() => {
    void boot();
    const first = () => unlockAudio();
    window.addEventListener('pointerdown', first, { once: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen.get() !== 'run') closeTopModal();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  return (
    <>
      {sc === 'boot' && <div class="screen center"><div class="logo spin">✦</div><p>{t('app.loading')}</p></div>}
      {sc === 'login' && <Login />}
      {sc === 'heroes' && <HeroSelect />}
      {sc === 'camp' && <Camp />}
      {sc === 'run' && <RunScreen />}
      {sc === 'loot' && <LootScreen />}
      <StoryOverlay />
      <Toasts />
    </>
  );
}
