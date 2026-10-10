# Qwik City (node-server adapter) for the 2-server simulation (sim/): SSR on every request, no caching, one Node process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Not `qwik build`: Qwik 1.20.2's CLI requires `ignore`, which it only lists as its own devDependency, so the CLI
# crashes in a clean install. It runs these two Vite builds (plus a type check and lint); run them directly.
RUN pnpm run build.client && pnpm run build.server

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# ORIGIN is optional: unset, the form-post CSRF check derives the origin from the Host header (see README).
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# The adapter bundles everything the server needs into server/ (no runtime node_modules); dist/ holds the client
# JS/CSS, which the server serves from ../dist relative to server/.
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node server/entry.node-server.js"]
