# Astro (@astrojs/node standalone) for the 2-server simulation (sim/): SSR on every request, no caching, one Node process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Hosts whose Host header is trusted for the form-post origin check (any port); see astro.config.mjs.
ARG ALLOWED_HOSTS=localhost,127.0.0.1
RUN ALLOWED_HOSTS=$ALLOWED_HOSTS pnpm build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# The build bundles everything the server needs into dist/server (no runtime node_modules); dist/client is empty
# because the only stylesheet is inlined into each page.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node dist/server/entry.mjs"]
