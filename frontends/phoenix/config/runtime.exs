import Config

config :feed,
  backend_url: String.trim_trailing(System.get_env("BACKEND_URL", "http://127.0.0.1:4000"), "/"),
  jwt_secret: System.get_env("JWT_SECRET", "twelve-dollar-challenge")

{:ok, ip} = :inet.parse_address(String.to_charlist(System.get_env("HOST", "127.0.0.1")))

config :feed, FeedWeb.Endpoint,
  http: [ip: ip, port: String.to_integer(System.get_env("PORT", "3000"))],
  # Signs the session cookie (which only holds the CSRF token). The container contract has no secret env, so a fixed
  # demo value is the fallback; set SECRET_KEY_BASE in a real deployment.
  secret_key_base:
    System.get_env("SECRET_KEY_BASE") ||
      "demo-secret-key-base-for-the-ssr-benchmark-only-not-for-production-use-0123456789abcdef"

if System.get_env("PHX_SERVER") do
  config :feed, FeedWeb.Endpoint, server: true
end
