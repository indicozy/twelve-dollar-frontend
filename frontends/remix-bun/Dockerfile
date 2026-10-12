# Remix (React Router 7 framework mode) on Bun for the 2-server simulation (sim/): the same app code and the same
# production build as ../remix (react-router build with Node + pnpm). Only the server changes: instead of
# react-router-serve (Express on Node), server.ts hands Bun.serve's Requests to react-router's Fetch API
# createRequestHandler, on Bun 1.4.3. SSR on every request, no caching, one Bun process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM oven/bun:1.4.3-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json server.ts ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
HEALTHCHECK --interval=2s --retries=30 CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec bun server.ts"]
