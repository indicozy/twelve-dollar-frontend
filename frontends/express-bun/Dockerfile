# Express 5 + Nunjucks on Bun for the 2-server simulation (sim/): the same app as ../express-nunjucks (SSR on every
# request, no caching, one process). Only the runtime changes: server.js runs on Bun 1.4.3 instead of Node 24.
# Dependencies are installed by pnpm from the same lockfile (on Node, like ../express-nunjucks), so the exact same
# package versions end up in node_modules; Bun only runs the code.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

FROM oven/bun:1.4.3-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY lib ./lib
COPY views ./views
COPY public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec bun server.js"]
