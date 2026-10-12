import Config

# No per-request log lines ("GET /", "Sent 200 in ..."): Phoenix logs them at :info; the other variants log nothing
# per request, so production runs at :warning.
config :logger, level: :warning
