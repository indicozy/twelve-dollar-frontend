# Express 5 + EJS for the 2-server simulation (sim/): SSR on every request, no caching, one Node process.
# Plain JavaScript (ES modules): no build step, so a single stage installs the production dependencies and runs.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile && rm -rf /root/.cache /root/.local/share/pnpm/store
COPY server.js ./
COPY lib ./lib
COPY views ./views
COPY public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node server.js"]
