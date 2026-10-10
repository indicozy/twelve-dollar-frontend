# Next.js on Bun for the 2-server simulation (sim/): the same app and the same production build as ../nextjs
# (built with Node + pnpm, standalone output). Only the runtime changes: the standalone server.js runs on Bun
# instead of Node, so the benchmark isolates runtime cost.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM oven/bun:1.4.3-slim
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec bun server.js"]
