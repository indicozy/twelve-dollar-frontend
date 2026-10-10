# Nuxt 4 (Nitro node-server preset) for the 2-server simulation (sim/): SSR on every request, no caching, one Node
# process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: the postinstall (`nuxt prepare`) needs the sources; `nuxt build` below does the same work.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# Nitro bundles the server and traces the few runtime packages it needs into .output/server/node_modules,
# so .output is the whole app (no install step in this stage).
COPY --from=build /app/.output ./.output
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node .output/server/index.mjs"]
