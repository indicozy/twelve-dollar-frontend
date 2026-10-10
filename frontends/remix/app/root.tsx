import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import { NotFound } from "./components/not-found";
import { currentUsername } from "./lib/session.server";
import "./app.css";

// Reads the `token` cookie on every request, like the Next.js layout and SvelteKit's +layout.server.ts.
export const loader = ({ request }: Route.LoaderArgs) => ({ username: currentUsername(request) });

export const meta: Route.MetaFunction = () => [
  { title: "Feed · Remix" },
  { name: "description", content: "SSR benchmark app: Remix (React Router 7) frontend over a Rust + SQLite feed API" },
];

// The header lives in Layout so error pages (404s render the root ErrorBoundary) keep it too.
export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="top">
          <Link to="/" className="brand">
            feed<span>.</span>
          </Link>
          <span className="stack">remix</span>
          <nav>{root?.username ? <span className="who">@{root.username}</span> : <Link to="/login">Sign in</Link>}</nav>
        </header>
        <main>{children}</main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Missing posts (the post loader throws a 404) and unknown paths (no route matches) both land here.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <div className="empty">
      <h1>Something went wrong</h1>
      <Link to="/">← back to feed</Link>
    </div>
  );
}
