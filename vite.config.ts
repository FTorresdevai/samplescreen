import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || './',
  plugins: [react()],
  build: {
    // index.html = landing page, app.html = the visualizer app
    rollupOptions: { input: { main: 'index.html', app: 'app.html' } },
  },
  server: {
    host: 'localhost', // LAN access only on demand: npm run dev -- --host
    port: 3000,
    open: false,
  },
});
