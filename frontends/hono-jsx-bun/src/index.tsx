// Bun entrypoint: one Bun process serving the Hono app with Bun.serve (Bun's defaults otherwise, e.g. idleTimeout 10 s).
import { serveStatic } from 'hono/bun';
import { app } from './app.js';

// /styles.css (verbatim ../shared/styles.css). Registered after the routes, so page requests never reach it; it only
// sees paths no route matched, and falls through to the 404 page when the file doesn't exist.
app.use(serveStatic({ root: './public' }));

const server = Bun.serve({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
});
console.log(`hono (bun ${Bun.version}) listening on ${server.url} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);

// PID 1 in Docker gets SIGTERM on `docker stop`; stop the listener and exit instead of waiting for SIGKILL.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.stop();
    process.exit(0);
  });
}
