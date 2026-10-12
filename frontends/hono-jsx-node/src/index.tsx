// Node entrypoint: one Node process serving the Hono app with @hono/node-server (node:http + Web Request/Response).
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app.js';

// /styles.css (verbatim ../shared/styles.css). Registered after the routes, so page requests never reach it; it only
// sees paths no route matched, and falls through to the 404 page when the file doesn't exist.
app.use(serveStatic({ root: './public' }));

const hostname = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

// Node's http defaults are kept (keepAliveTimeout 5 s), as in the other Node variants.
const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`hono (node ${process.version}) listening on http://${info.address}:${info.port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
});

// PID 1 in Docker gets SIGTERM on `docker stop`; close the listener and exit instead of waiting for SIGKILL.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
