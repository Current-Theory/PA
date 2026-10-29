import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwa } from './build/pwa';

export default defineConfig({
  plugins: [react(), pwa()],
  server: { proxy: { '/api/assistant': 'http://127.0.0.1:8787' } }
});
