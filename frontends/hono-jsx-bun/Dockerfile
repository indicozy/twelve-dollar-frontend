# Hono 4 + hono/jsx on Bun for the 2-server simulation (sim/): SSR on every request, no caching, one Bun process.
# TypeScript/TSX runs as source (Bun transpiles on load), so a single stage installs the production dependencies and runs.
FROM oven/bun:1.4.3-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json bun.lock bunfig.toml ./
RUN bun install --production --frozen-lockfile && rm -rf /root/.bun/install/cache
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec bun run src/index.tsx"]
