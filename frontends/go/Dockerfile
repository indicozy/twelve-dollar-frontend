# Go (standard library only: net/http + html/template) for the 2-server simulation (sim/): SSR on every request,
# no caching, one process (GOMAXPROCS left at the runtime default, which follows the container's CPU quota).
FROM golang:1.27.2-bookworm AS build
WORKDIR /src
COPY go.mod ./
# Templates and the stylesheet are embedded into the binary (//go:embed); no third-party modules, so no go.sum.
COPY *.go ./
COPY templates ./templates
COPY static ./static
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/feed-frontend .

FROM debian:bookworm-20261005-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl iproute2 && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/feed-frontend /usr/local/bin/feed-frontend
ENV HOST=0.0.0.0 PORT=3000
HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec feed-frontend"]
