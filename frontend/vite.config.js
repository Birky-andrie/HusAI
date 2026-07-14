import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works on Vercel/Netlify AND under file:// in Electron.
  base: './',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
