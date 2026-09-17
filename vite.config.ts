import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// `VITE_BASE` lets the same build serve from a GitHub Pages project path
// (/Event-Production/) or from a custom domain root without code changes.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Never auto-reload: a forced refresh mid-show is unacceptable.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'BabyProducer: Event Production OS',
        short_name: 'BabyProducer',
        description: 'Offline-first event production: guests, seating, run of show, onsite.',
        theme_color: '#0b0b0e',
        background_color: '#0b0b0e',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    // The manifest lets the budget check measure the eager shell only,
    // rather than counting lazily loaded module chunks against it.
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/component/**/*.test.{ts,tsx}'],
  },
});
