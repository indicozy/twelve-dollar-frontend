/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFound } from "../components/NotFound";
import { usernameQuery } from "../lib/queries";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Feed · TanStack Start" },
      { name: "description", content: "SSR benchmark app: TanStack Start frontend over a Rust + SQLite feed API" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  // The signed-in name comes from the token cookie, read on the server for every request.
  loader: async ({ context }) => {
    await context.queryClient.query(usernameQuery);
  },
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

function Who() {
  const { data: name } = useSuspenseQuery(usernameQuery);
  return name ? <span className="who">@{name}</span> : <Link to="/login">Sign in</Link>;
}

function RootLayout() {
  return (
    <>
      <header className="top">
        <Link to="/" className="brand">
          feed<span>.</span>
        </Link>
        <span className="stack">tanstack start</span>
        <nav>
          <Who />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
