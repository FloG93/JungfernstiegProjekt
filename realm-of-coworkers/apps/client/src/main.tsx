import { render } from 'preact';
import { App } from './app';
import { applyDocumentSettings } from './lib/settings';
import './styles.css';

applyDocumentSettings();
const root = document.getElementById('app');
if (root) render(<App />, root);

// PWA: Offline-Hülle, nur im gebauten Client (E-022)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
