// Erzählung (3.2): Story-Text vor der Stage, Dialog vor und nach dem Boss. Überspringbar; ohne Eingabe läuft
// der Text nach einigen Sekunden weiter, damit der Run nebenbei weiterläuft (E-023).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { useStore } from '../lib/store';
import { heroState, story } from '../state';

const MS_PER_LINE = 5000;

export function StoryOverlay(): JSX.Element | null {
  const s = useStore(story);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [s]);
  useEffect(() => {
    if (!s) return;
    const h = setTimeout(() => next(), MS_PER_LINE);
    return () => clearTimeout(h);
  });
  if (!s) return null;
  const line = s.lines[i];
  function next() {
    if (!s) return;
    if (i + 1 < s.lines.length) {
      setI(i + 1);
      return;
    }
    const hs = heroState.get();
    if (s.textId && hs && !hs.storySeen.includes(s.textId)) void api.storySeen(hs.hero.id, s.textId).catch(() => undefined);
    story.set(null);
  }
  return (
    <div class="story" onClick={() => next()} role="dialog" aria-label={s.title} data-testid="story">
      <div class="story-box">
        <small class="muted">{s.title}</small>
        {line?.speaker && <b>{line.speaker}</b>}
        <p>{line?.text}</p>
        <small class="muted">{t('app.tapToContinue')} · {i + 1}/{s.lines.length}</small>
      </div>
    </div>
  );
}
