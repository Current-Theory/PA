import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

// Retire older shell caches so offline navigation cannot bypass hosted sign-in.
// Keep this URL public so an existing worker can update after logout.
export function pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'earnlearn-static-pwa', apply: 'build',
    configResolved(value) { config = value; },
    async closeBundle() {
      await writeFile(resolve(config.root, config.build.outDir, 'sw.js'), `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('earnlearn-shell-')).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
// No fetch handler or offline shell: requests always go to the SWA gateway.
`);
    }
  };
}
