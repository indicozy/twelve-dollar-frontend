# SvelteKit (adapter-node) for the 2-server simulation (sim/): SSR on every request, no caching, one Node process.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Form actions only accept this origin (plus its 127.0.0.1 twin); see vite.config.ts.
ARG ORIGIN=http://localhost:3000
RUN ORIGIN=$ORIGIN pnpm build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# adapter-node bundles everything the server needs into build/ (the app has no runtime dependencies)
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec node build"]
