// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        strategies: 'generateSW',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          globIgnores: ['**/node_modules/**'],
        },
        manifest: {
          name: 'RAMA Multi-services',
          short_name: 'RAMA',
          description: 'Sistèm jesyon prè ak kliyan',
          theme_color: '#16a34a',
          background_color: '#f0fdf4',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'favicon.ico',
              sizes: '192x192',
              type: 'image/x-icon'
            },
            {
              src: 'favicon.ico',
              sizes: '512x512',
              type: 'image/x-icon'
            }
          ]
        }
      })
    ]
  }
});
