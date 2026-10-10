# Frontend SSR spec

Every framework in `frontends/` implements the **same app** so the benchmark measures the framework's
server-side rendering, not differences in features or markup. Next.js (`frontends/nextjs`) is the reference.

## Runtime contract

| Env | Default | |
|---|---|---|
| `BACKEND_URL` | `http://127.0.0.1:4000` | the Rust API (`backend/`), the challenge SPEC's endpoints |
| `JWT_SECRET` | `twelve-dollar-challenge` | only used to sign demo tokens on `/login` |
| `HOST`, `PORT` | `127.0.0.1`, `3000` | where the frontend listens |

Production build, one server process unless the framework's default production setup says otherwise
(document it). No response/HTML caching: **every page request calls the API and renders fresh data.**

## Pages (server-rendered HTML)

| Route | Calls | Renders |
|---|---|---|
| `GET /` | `GET /feed` | header, compose form, the 20 posts |
| `GET /posts/:id` | `GET /posts/:id` | back link + one post; 404 page if missing/invalid |
| `GET /login` | — | form (user id, username) that sets a `token` cookie with an HS256 JWT |

Post markup (the load test relies on `data-post-id` and the `href`):

```html
<article class="post" data-post-id="123">
  <header><span class="author">@name</span><time datetime="…">Dec 31, 2025, 11:59 PM UTC</time></header>
  <p>body</p>
  <footer>
    <form …><input type="hidden" name="id" value="123"><button class="like">♥ <span>5</span></button></form>
    <a href="/posts/123">#123</a>   <!-- on the post page: <span class="muted">#123</span> -->
  </footer>
</article>
```

Use `shared/styles.css` verbatim as the only stylesheet, and the system font stack (no web fonts).
Likes and new posts use the framework's idiomatic mutation (server actions, form actions, …).

## JSON passthrough routes (used by the load test for writes)

| Route | Forwards to | Notes |
|---|---|---|
| `POST /api/posts` | `POST /posts` | forward the `Authorization` header as-is, return the API's status + JSON |
| `POST /api/posts/:id/like` | `POST /posts/:id/like` | same |

## Load test

`bench/ssr-load.js` — the challenge's user loop over pages: feed page → 3–7 s → post page → 3–8 s →
like (15%) → create (2%) → 5–15 s. Pass: p95 < 500 ms, p99 < 1 s, < 1% errors.
