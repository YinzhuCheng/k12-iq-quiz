import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Cloudflare Pages serves from site root; public/ is copied to dist/ automatically.
  base: '/',
});

