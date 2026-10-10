#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
RUSTFLAGS="${RUSTFLAGS:--C target-cpu=native}" cargo build --release --locked 2>/dev/null || RUSTFLAGS="${RUSTFLAGS:--C target-cpu=native}" cargo build --release
