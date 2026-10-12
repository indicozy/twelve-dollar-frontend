# Next.js behind an nginx microcache, both in one container (like ../laravel's nginx + php-fpm), for the 2-server
# simulation (sim/). The app and its production build are identical to ../nextjs (standalone output, Node 24);
# the only change is the architecture: nginx (1 worker) listens on :3000 and caches anonymous GET / for 1 s and
# GET /posts/<id> for 5 s in front of the Next.js server on 127.0.0.1:3001. See README.md and docker/nginx.conf.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends iproute2 nginx-light=1.22.1-9+deb12u10 \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled /etc/nginx/conf.d \
 && mkdir -p /var/cache/nginx/micro
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
HEALTHCHECK --interval=2s --retries=30 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
