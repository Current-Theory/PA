import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';

// Bundle the same application into one file: no server, imports, CDN or install.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'dist-portable');
const assets = join(output, 'assets');
await build({
  root, configFile: false, publicDir: false, plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_PORTABLE': JSON.stringify('true'),
    'import.meta.env.VITE_ENTRA_CLIENT_ID': JSON.stringify(''),
    'import.meta.env.VITE_ENTRA_TENANT_ID': JSON.stringify(''),
    'import.meta.env.VITE_ENTRA_REDIRECT_URI': JSON.stringify('')
  },
  build: {
    outDir: assets, emptyOutDir: true, cssCodeSplit: false,
    lib: { entry: join(root, 'src/main.tsx'), name: 'EarnLearnWorkHub', formats: ['iife'], fileName: () => 'work-hub.js' }
  }
});
const files = await readdir(assets);
const cssFile = files.find(file => file.endsWith('.css'));
if (!cssFile) throw new Error('The portable stylesheet was not emitted.');
const js = (await readFile(join(assets, 'work-hub.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await readFile(join(assets, cssFile), 'utf8')).replace(/<\/style/gi, '<\\/style');
const icon = Buffer.from(await readFile(join(root, 'public/icon.svg'))).toString('base64');
const html = `<!doctype html>
<html lang="en-NZ"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#102c37"><title>Work Hub · EarnLearn</title>
<link rel="icon" href="data:image/svg+xml;base64,${icon}">
<style>${css}</style></head><body><div id="root"><p>Loading your workspace…</p></div>
<script>${js}</script></body></html>`;
const instructions = `EARNLEARN WORK HUB — DOWNLOADABLE DEMO

1. Extract this ZIP first (right-click > Extract All on Windows).
2. Move the extracted folder somewhere you want to keep it.
3. Open "EarnLearn Work Hub.html" in Microsoft Edge or Google Chrome.
   If asked which app to use, choose Edge or Chrome. No terminal is needed.

No install, account, Node.js, server or Internet connection is required.
All styles and application code are included in the single HTML file.

TRY IT
- Type a task into Add a task and press Enter.
- Click a task to edit notes, status, due date, checklist and outcome.
- Check a task to complete it; find it later under Completed.
- Try Waiting, workstreams and Search. Refresh to check persistence.
- The Assistant is embedded in the app. AI requires the hosted version
  and its secure server-side API connection; this file never holds a key.
  The manual task/project workspace remains available offline.
- Settings > Reset demo workspace restores the fictional examples.

Keep using the same file location and browser profile. Demo tasks are saved
in that browser's IndexedDB, not inside the HTML file. Private browsing,
clearing browser storage or changing profiles can remove/hide that data.
Corporate browser policies can block file-based storage; ask IT if the
app reports storage unavailable. Keep confidential information out.

THIS IS THE FUNCTIONAL DEMO, NOT A LIVE MICROSOFT CONNECTION.
Outlook/Teams/Planner source labels are fictional sample provenance.
Microsoft integration and PWA installation require the hosted version
and the additional integration work documented in the repository.

Source and integration guide: https://github.com/Current-Theory/PA
`;
await writeFile(join(output, 'EarnLearn Work Hub.html'), html);
await writeFile(join(output, 'START HERE.txt'), instructions);
const runtimePackages = ['react', 'react-dom', 'scheduler', 'lucide-react', '@azure/msal-browser', '@azure/msal-react', '@azure/msal-common', 'zod'];
const notices: string[] = [];
for (const name of runtimePackages) {
  const metadata = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'));
  notices.push(`${name} ${metadata.version}\n${await readFile(join(root, 'node_modules', name, 'LICENSE'), 'utf8')}`);
}
const licenseText = `THIRD-PARTY LICENSE NOTICES\n\n${notices.join('\n\n----------------------------------------\n\n')}`;
await writeFile(join(output, 'THIRD-PARTY-NOTICES.txt'), licenseText);
await mkdir(join(root, 'downloads'), { recursive: true });
const fileOptions = { mtime: new Date('2026-01-01T12:00:00Z') };
const archive = zipSync({
  'EarnLearn Work Hub.html': [strToU8(html), fileOptions],
  'START HERE.txt': [strToU8(instructions), fileOptions],
  'THIRD-PARTY-NOTICES.txt': [strToU8(licenseText), fileOptions]
}, { level: 9 });
await writeFile(join(root, 'downloads/EarnLearn-Work-Hub.zip'), archive);
console.log(`Portable demo: downloads/EarnLearn-Work-Hub.zip (${Math.round(archive.length / 1024)} KB)`);
