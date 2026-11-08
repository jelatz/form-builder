import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflareD1DevPlugin } from './cloudflare/vite-d1-plugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflareD1DevPlugin()],
});
