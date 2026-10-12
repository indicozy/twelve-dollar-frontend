# HonoX (hono/jsx + one island) on Bun for the 2-server simulation (sim/): SSR on every request, no caching, one Bun
# process. Build stage: `vite build --mode client && vite build` (run by Bun) → dist/ = index.js (server bundle with
# hono + honox inlined), static/ (island runtime JS), styles.css. The runtime stage needs only dist/, no node_modules.
FROM oven/bun:1.4.3-slim AS build
WORKDIR /src
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY app ./app
COPY public ./public
RUN bun --bun run build

FROM oven/bun:1.4.3-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/dist
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /src/dist ./
HEALTHCHECK --interval=2s --retries=30 CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec bun index.js"]
