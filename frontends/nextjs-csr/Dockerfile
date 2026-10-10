# Client-side-only Next.js for the 2-server simulation (sim/): static export served by nginx, API proxied.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27.3-alpine
RUN apk add --no-cache iproute2
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/out /usr/share/nginx/html
ENV API_UPSTREAM=api:4000 LISTEN_PORT=3000 NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
HEALTHCHECK --interval=2s --retries=30 CMD wget -qO /dev/null http://127.0.0.1:${LISTEN_PORT}/ || exit 1
EXPOSE 3000
