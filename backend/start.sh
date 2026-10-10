#!/usr/bin/env bash
# Env: SQLITE_PATH, JWT_SECRET, HOST, PORT (see SPEC), optional THREADS (default: all cores).
exec "$(dirname "$0")/target/release/feed-server"
