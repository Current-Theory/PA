import React from 'react';
import ReactDOM from 'react-dom/client';
import { checkHostedAccess } from './lib/hostedAuth';
import './styles.css';

async function start() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  if (import.meta.env.PROD && import.meta.env.VITE_PORTABLE !== 'true') {
    root.render(<p role="status">Checking Microsoft sign-in…</p>);
    try {
      const access = await checkHostedAccess();
      if (access !== 'allowed') {
        window.location.replace(access === 'login' ? '/.auth/login/aad?post_login_redirect_uri=/' : '/access-denied');
        return;
      }
    } catch {
      root.render(<main><h1>Sign-in check unavailable</h1><p>Your workspace is locked until Microsoft sign-in can be verified.</p><a href="/">Retry</a></main>);
      return;
    }
  }
  const { App } = await import('./App');
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
void start();
