# express-nunjucks: Express 5 + Nunjucks, server-rendered on every request, no caching

The same app as `../express` (routes, API client, forms, origin check, JSON passthrough routes, Dockerfile) with one
change: the views are **Nunjucks** templates instead of EJS. Nunjucks is Mozilla's Jinja2-inspired engine, so the
templates use the same syntax as the Flask variant (`{% extends %}`, `{% block %}`, `{% include %}`, `{{ value }}`,
autoescaping). Comparing the two Express variants isolates the cost of the template engine; comparing this one with
`../flask` compares Node and Python on Jinja-style templates.

| | |
|---|---|
| Versions | Express 5.3.0, Nunjucks 3.2.4, Node 24, pnpm 10.8.0 |
| Templates | `views/base.njk` (layout), `index.njk`, `post.njk`, `login.njk`, `404.njk`, `partials/post.njk` |
| Setup | `nunjucks.configure(views, { autoescape: true, express: app, noCache: NODE_ENV !== "production" })` |
| Rendering | each template compiles to a JS function on first use and is kept (production); a render walks the compiled function, string building with autoescaping |
| Feed page | about 12.2 KB (EJS: 10.5 KB; Nunjucks keeps more of the template's whitespace) |

Everything else (behaviour, headers, ETag, keep-alive, the Origin check, `/actions/*` and `/api/*` routes) is
described in `../express/README.md`.

```bash
pnpm install --frozen-lockfile
NODE_ENV=production BACKEND_URL=http://127.0.0.1:4000 PORT=3000 node server.js
```
