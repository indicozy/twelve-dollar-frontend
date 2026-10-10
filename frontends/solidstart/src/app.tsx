import { createAsync, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Show, Suspense } from "solid-js";
import { getUsername } from "./lib/queries";
import "./styles.css";

function Who() {
  // Read from the token cookie on the server for every request (like the Next.js layout).
  const name = createAsync(() => getUsername());
  return (
    <Show when={name()} fallback={<a href="/login">Sign in</a>}>
      {(n) => <span class="who">@{n()}</span>}
    </Show>
  );
}

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <header class="top">
            <a href="/" class="brand">
              feed<span>.</span>
            </a>
            <span class="stack">solidstart</span>
            <nav>
              <Suspense>
                <Who />
              </Suspense>
            </nav>
          </header>
          <main>
            <Suspense>{props.children}</Suspense>
          </main>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
