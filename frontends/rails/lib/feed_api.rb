require "net/http"

# API client (no caching: every call hits the API). Net::HTTP from the standard library, one persistent keep-alive
# connection per Puma thread: Puma's thread pool is fixed (3 threads), so each thread opens one TCP connection to the
# API and reuses it for every request it serves.
module FeedApi
  BASE = URI(ENV.fetch("BACKEND_URL", "http://127.0.0.1:4000").sub(%r{/+\z}, ""))
  JSON_HEADERS = { "Content-Type" => "application/json" }.freeze

  module_function

  def feed
    res = request(Net::HTTP::Get.new("/feed"))
    raise "feed: backend returned #{res.code}" unless res.code == "200"
    JSON.parse(res.body)["posts"]
  end

  # The post hash, or nil when the API says 404/400 (missing or invalid id).
  def post(id)
    res = request(Net::HTTP::Get.new("/posts/#{ERB::Util.url_encode(id.to_s)}"))
    return nil if res.code == "404" || res.code == "400"
    raise "post: backend returned #{res.code}" unless res.code == "200"
    JSON.parse(res.body)["post"]
  end

  # `authorization` is the full header value ("Bearer <jwt>") or nil to send none. Returns the Net::HTTPResponse.
  def create_post(authorization, body)
    req = Net::HTTP::Post.new("/posts", JSON_HEADERS)
    req["Authorization"] = authorization if authorization
    req.body = JSON.generate({ body: body })
    request(req)
  end

  def like_post(authorization, id)
    req = Net::HTTP::Post.new("/posts/#{ERB::Util.url_encode(id.to_s)}/like")
    req["Authorization"] = authorization if authorization
    request(req)
  end

  # Net::HTTP#start without a block keeps the socket open between requests (HTTP/1.1 keep-alive). Net::HTTP itself
  # reconnects when the socket was closed or idle longer than keep_alive_timeout (2 s), and retries idempotent requests
  # once on a stale connection. On any error the thread's connection is dropped and the next call opens a new one.
  def request(req)
    connection.request(req)
  rescue StandardError
    reset_connection
    raise
  end

  def connection
    Thread.current[:feed_api_http] ||= Net::HTTP.new(BASE.host, BASE.port).tap do |http|
      http.use_ssl = BASE.scheme == "https"
      http.start
    end
  end

  def reset_connection
    http = Thread.current[:feed_api_http]
    Thread.current[:feed_api_http] = nil
    http&.finish if http&.started?
  rescue IOError
    nil
  end
end
