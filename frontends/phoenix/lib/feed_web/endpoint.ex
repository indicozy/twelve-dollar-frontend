defmodule FeedWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :feed

  # Phoenix's default cookie session (signed, not encrypted). It only carries the CSRF token: the demo JWT lives in
  # its own `token` cookie, as in the other variants.
  @session_options [store: :cookie, key: "_feed_key", signing_salt: "fEeD5alt", same_site: "Lax"]

  # /styles.css (verbatim ../shared/styles.css). `only:` makes the check a list lookup, no fs.stat on page requests.
  plug Plug.Static, at: "/", from: :feed, gzip: false, only: FeedWeb.static_paths()

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  # Form bodies only. JSON bodies are left unread so /api/posts can parse the raw bytes strictly itself.
  plug Plug.Parsers, parsers: [:urlencoded], pass: ["*/*"]

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug FeedWeb.Router
end
