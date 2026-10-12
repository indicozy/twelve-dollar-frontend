import type { Child } from 'hono/jsx';

// Page shell: the header shows @username (from the token cookie) or "Sign in".
export const Layout = ({ username, children }: { username: string | null; children?: Child }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Feed · Hono</title>
      <meta name="description" content="SSR benchmark app: Hono JSX frontend over a Rust + SQLite feed API" />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>
      <header class="top">
        <a href="/" class="brand">
          feed<span>.</span>
        </a>
        <span class="stack">hono jsx</span>
        <nav>{username ? <span class="who">@{username}</span> : <a href="/login">Sign in</a>}</nav>
      </header>
      <main>{children}</main>
    </body>
  </html>
);
