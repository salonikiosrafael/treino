import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativo + HashRouter: funciona em https://<user>.github.io/<repo>/ sem configurar nada.
export default defineConfig({
  build: { chunkSizeWarningLimit: 700 }, // chunk do dataset (≈110 KB gzip) é esperado
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // o app avisa quando há versão nova; nunca recarrega no meio de um treino
      injectRegister: false,
      includeManifestIcons: false, // já entram pelo globPatterns (evita entradas duplicadas no precache)
      manifest: {
        name: 'Treino — registro de musculação',
        short_name: 'Treino',
        description: 'Registro pessoal de treinos de musculação. Dados ficam só no seu aparelho.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pré-cache de tudo (inclusive as imagens) para funcionar 100% offline.
        globPatterns: ['**/*.{js,css,html,png,svg,webp,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
