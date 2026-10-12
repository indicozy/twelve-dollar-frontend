// Server entry: HonoX builds the Hono app from the files in app/routes (routes, _renderer, _middleware, _404, _error).
// Every page is rendered on every request from a fresh API call; nothing is cached.
import { createApp } from 'honox/server';

const app = createApp();

console.log(
  `honox (bun ${Bun.version}) listening on http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 3000} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`,
);

// PID 1 in Docker gets SIGTERM on `docker stop`; Bun auto-serves the default export and would otherwise ignore it.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => process.exit(0));

export default app;
