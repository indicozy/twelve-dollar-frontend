// Page shell for c.render(): <!DOCTYPE html> + the layout, rendered to one string (stream: false, the default).
// <Script> emits the island runtime's <script> only on pages whose route imports an island (feed and post pages).
import { jsxRenderer } from 'hono/jsx-renderer';
import { Script } from 'honox/server';

export default jsxRenderer(({ children }, c) => {
  const username = c.get('username');
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Feed · HonoX</title>
        <meta name="description" content="SSR benchmark app: HonoX frontend over a Rust + SQLite feed API" />
        <link rel="stylesheet" href="/styles.css" />
        <Script src="/app/client.ts" async />
      </head>
      <body>
        <header class="top">
          <a href="/" class="brand">
            feed<span>.</span>
          </a>
          <span class="stack">honox</span>
          <nav>{username ? <span class="who">@{username}</span> : <a href="/login">Sign in</a>}</nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
});
