# Angular 22 SSR (@angular/ssr + the CLI-generated Express server.ts) for the 2-server simulation (sim/): every route
# RenderMode.Server, no caching, one Node process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# The server bundle (dist/angular/server) includes Express and all of Angular; it imports only node: builtins, so
# dist/ is the whole app (no node_modules in this stage).
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node dist/angular/server/server.mjs"]
