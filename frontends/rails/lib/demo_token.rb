require "base64"
require "openssl"

# Demo session: the same HS256 token as frontends/sveltekit/src/lib/server/session.ts (the API has no login endpoint).
module DemoToken
  SECRET = ENV.fetch("JWT_SECRET", "twelve-dollar-challenge")

  module_function

  def b64url(str) = Base64.urlsafe_encode64(str, padding: false)

  def sign(user_id, username)
    now = Time.now.to_i
    head = b64url(JSON.generate({ alg: "HS256", typ: "JWT" }))
    body = b64url(JSON.generate({ sub: user_id.to_s, username: username, iat: now, exp: now + 7 * 86_400 }))
    sig = b64url(OpenSSL::HMAC.digest("SHA256", SECRET, "#{head}.#{body}"))
    "#{head}.#{body}.#{sig}"
  end

  # Read from the token cookie's payload on every request (not verified, like the JS variants).
  def username(token)
    return nil if token.blank?
    payload = JSON.parse(Base64.urlsafe_decode64(token.split(".")[1].to_s))
    payload.is_a?(Hash) ? payload["username"].presence : nil
  rescue ArgumentError, JSON::ParserError
    nil
  end
end
