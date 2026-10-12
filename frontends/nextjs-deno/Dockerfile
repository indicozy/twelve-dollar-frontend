# Next.js on Deno for the 2-server simulation (sim/): the same app and the same production build as ../nextjs
# (built with Node + pnpm, standalone output). Only the runtime changes: the standalone server.js runs on Deno 2.9.7
# (Node compatibility layer) instead of Node, so the benchmark isolates runtime cost.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# The one Deno-specific change: Deno treats .js as ESM unless the nearest package.json says "type": "commonjs".
# The standalone server.js and the compiled .next/server chunks are CommonJS (Node assumes that when "type" is
# missing), so mark the standalone package.json explicitly. Same semantics on Node; nothing else is touched.
RUN node -e "const f='.next/standalone/package.json',fs=require('fs'),p=JSON.parse(fs.readFileSync(f));p.type='commonjs';fs.writeFileSync(f,JSON.stringify(p,null,2))"

FROM denoland/deno:debian-2.9.7
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DENO_NO_UPDATE_CHECK=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["deno", "eval", "fetch('http://127.0.0.1:3000/').then(r=>Deno.exit(r.ok?0:1),()=>Deno.exit(1))"]
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec deno run -A server.js"]
