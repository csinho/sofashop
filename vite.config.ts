import path from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

const PWA_DEFAULTS = {
  name: 'SofáShop',
  description: 'Catálogo e gestão multi-loja para sofás e móveis.',
} as const

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pwaName = (env.VITE_PWA_NAME || PWA_DEFAULTS.name).trim() || PWA_DEFAULTS.name
  const pwaShortName = (env.VITE_PWA_SHORT_NAME || pwaName).trim() || pwaName
  const pwaDescription = (env.VITE_PWA_DESCRIPTION || PWA_DEFAULTS.description).trim() || PWA_DEFAULTS.description
  const docTitle = (env.VITE_PWA_DOCUMENT_TITLE || `${pwaName} — Catálogo online`).trim()

  return {
    plugins: [
      {
        name: 'inject-pwa-index-env',
        enforce: 'pre',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string) {
            return html
              .replace(/\{\{VITE_PWA_DESCRIPTION\}\}/g, escapeHtmlAttr(pwaDescription))
              .replace(/\{\{VITE_PWA_SHORT_NAME\}\}/g, escapeHtmlAttr(pwaShortName))
              .replace(/\{\{VITE_PWA_DOCUMENT_TITLE\}\}/g, escapeHtmlAttr(docTitle))
          },
        },
      },
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: pwaName,
          short_name: pwaShortName,
          description: pwaDescription,
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          // Abre a raiz; a app redireciona o PWA (standalone) p/ /loja/... ou /admin conforme a última visita (ver LandingPage + PwaEntryHandler)
          start_url: '/',
          lang: 'pt-BR',
          categories: ['business', 'shopping'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
