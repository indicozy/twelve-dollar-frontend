// HonoX on Bun: `vite build --mode client` builds the island runtime (app/client.ts) into dist/static/ with a
// manifest; `vite build` then bundles the server (app/server.ts + every route, hono and honox included) into one file,
// dist/index.js, through @hono/vite-build's Bun adapter, which also serves dist's static files (styles.css, static/*).
import build from '@hono/vite-build/bun';
import adapter from '@hono/vite-dev-server/bun';
import honox from 'honox/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Keep process.env as the runtime object (BACKEND_URL, JWT_SECRET, HOST, PORT are read at startup), see the HonoX
  // README's "On-Premises" section.
  define: { 'process.env': 'process.env' },
  plugins: [
    honox({ devServer: { adapter }, client: { input: ['/app/client.ts'] } }),
    build({
      // The adapter's default `export default app` lets Bun auto-serve it on PORT (default hostname). Export the
      // Bun.serve options instead so HOST is honoured like in ../hono-jsx-bun (0.0.0.0 in the container).
      entryContentDefaultExportHook: (appName) =>
        `export default { fetch: ${appName}.fetch.bind(${appName}), hostname: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3000) }`,
    }),
  ],
});
