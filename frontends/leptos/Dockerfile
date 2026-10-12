# Leptos 0.8 (SSR + hydration, leptos_axum) for the 2-server simulation (sim/): SSR on every request, no caching,
# one process (Tokio multi-threaded runtime). cargo-leptos builds the crate twice: the Axum server binary (`ssr`,
# release profile) and the WASM hydration bundle (`hydrate`, wasm-release profile, wasm-bindgen + wasm-opt).
# Built inside bookworm so glibc matches the runtime image.
FROM rust:1.90.0-slim-bookworm AS build
ARG CARGO_LEPTOS_VERSION=0.3.11
ARG CARGO_BUILD_JOBS=4
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://github.com/leptos-rs/cargo-leptos/releases/download/v${CARGO_LEPTOS_VERSION}/cargo-leptos-x86_64-unknown-linux-musl.tar.gz" \
    | tar -xz --strip-components=1 -C /usr/local/cargo/bin cargo-leptos-x86_64-unknown-linux-musl/cargo-leptos
WORKDIR /src
# rust-toolchain.toml pins 1.90.0 + the wasm32 target.
COPY rust-toolchain.toml ./
RUN rustup show active-toolchain && rustup target add wasm32-unknown-unknown
COPY Cargo.toml Cargo.lock ./
# Dependency download layer (dummy targets so the manifest parses); source edits don't refetch.
RUN mkdir src && touch src/lib.rs && echo 'fn main(){}' > src/main.rs && cargo fetch --locked && rm -rf src
COPY public ./public
COPY src ./src
# (cargo-leptos has no --locked; the fetch above already checked Cargo.lock.) It fetches the wasm-bindgen CLI matching Cargo.lock and binaryen's wasm-opt on first use.
RUN cargo leptos build --release && ls -la target/site target/site/pkg

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl iproute2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/target/release/feed-leptos /usr/local/bin/feed-leptos
# site-root: /pkg/feed-leptos.{js,wasm} (hydration bundle) and /styles.css, served by leptos_axum's file handler.
COPY --from=build /src/target/site ./site
COPY Cargo.toml ./
ENV HOST=0.0.0.0 PORT=3000 LEPTOS_OUTPUT_NAME=feed-leptos LEPTOS_SITE_ROOT=site LEPTOS_SITE_PKG_DIR=pkg \
    LEPTOS_SITE_ADDR=0.0.0.0:3000 LEPTOS_ENV=PROD
HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec feed-leptos"]
