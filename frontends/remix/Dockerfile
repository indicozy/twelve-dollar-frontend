# Remix = React Router 7 framework mode, served by react-router-serve (Express) for the 2-server simulation (sim/):
# SSR on every request, no caching, one Node process. Stages follow the official template's Dockerfile
# (dev deps -> build, prod deps only -> runtime), with pnpm instead of npm.
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

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# NODE_ENV must be set before the server starts: react-router-serve only sets it after react is already loaded,
# which leaves react in development mode against react-dom's production build (every render then fails with 500).
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec ./node_modules/.bin/react-router-serve ./build/server/index.js"]
