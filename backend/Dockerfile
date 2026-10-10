# Rust API image for the 2-server simulation (sim/). Built inside the container so glibc matches the runtime.
FROM rust:1.90-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release --locked && rm -rf src
COPY src ./src
RUN touch src/main.rs && RUSTFLAGS="-C target-cpu=native" cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl iproute2 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/feed-server /usr/local/bin/feed-server
COPY docker-entrypoint.sh /usr/local/bin/
ENV HOST=0.0.0.0 PORT=4000 SQLITE_PATH=/data/feed.db JWT_SECRET=twelve-dollar-challenge
EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
