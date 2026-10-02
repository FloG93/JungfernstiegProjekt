// Anmeldung und Registrierung (14.1): Registrierung nur mit Einladungscode (2.8).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { afterLogin, errorToast, me } from '../state';
import { Btn } from './common';

export function Login(): JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const submit = async () => {
    try {
      const r = mode === 'login' ? await api.login(username, password) : await api.register(username, password, invite);
      me.set(r);
      await afterLogin();
    } catch (e) {
      errorToast(e);
    }
  };
  return (
    <div class="screen center login">
      <div class="brand">
        <div class="logo">✦</div>
        <h1>{t('app.title')}</h1>
        <p class="muted">{t('app.tagline')}</p>
      </div>
      <form
        class="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          {t('auth.username')}
          <input autocomplete="username" value={username} onInput={(e) => setUsername(e.currentTarget.value)} data-testid="login-username" />
        </label>
        <label>
          {t('auth.password')}
          <input type="password" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onInput={(e) => setPassword(e.currentTarget.value)} data-testid="login-password" />
        </label>
        {mode === 'register' && (
          <label>
            {t('auth.inviteCode')}
            <input value={invite} onInput={(e) => setInvite(e.currentTarget.value)} data-testid="login-invite" />
          </label>
        )}
        <button type="submit" class="btn primary" data-testid="login-submit">{mode === 'login' ? t('auth.login') : t('auth.register')}</button>
        <Btn kind="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} testid="login-toggle">
          {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
        </Btn>
      </form>
    </div>
  );
}
