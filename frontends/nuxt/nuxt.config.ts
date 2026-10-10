// Same setup as frontends/nextjs and frontends/sveltekit: server-rendered on every request, no caching (no
// routeRules, no prerendering), one Node process (Nitro's default `node-server` preset: node .output/server/index.mjs).
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/styles.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Feed · Nuxt',
      meta: [{ name: 'description', content: 'SSR benchmark app: Nuxt frontend over a Rust + SQLite feed API' }],
    },
  },
})
