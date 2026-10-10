// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

// No handler options: SolidStart's default render mode ("stream") is kept, like Next.js keeps its streaming default.
export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Feed · SolidStart</title>
          <meta name="description" content="SSR benchmark app: SolidStart frontend over a Rust + SQLite feed API" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
