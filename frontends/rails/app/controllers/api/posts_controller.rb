# JSON passthrough for the load test: forward Authorization as-is, return the API's status and JSON body unchanged.
# ActionController::API: no CSRF, no cookies/session, no views.
module Api
  class PostsController < ActionController::API
    # Don't let ParamsWrapper parse the JSON body (it would 400 with Rails' error page on bad JSON).
    wrap_parameters false

    def create
      # Strict parse of the raw body; `null` or an empty body are 400 too, like `(await request.json()).body`.
      data = JSON.parse(request.raw_post.to_s)
      raise JSON::ParserError, "null body" if data.nil?
      body = data.is_a?(Hash) ? data["body"] : nil
    rescue JSON::ParserError
      render json: { error: "malformed JSON body" }, status: :bad_request
    else
      passthrough FeedApi.create_post(request.headers["Authorization"], body.nil? ? "" : body.to_s)
    end

    def like
      passthrough FeedApi.like_post(request.headers["Authorization"], request.path_parameters[:id])
    end

    private

    def passthrough(res)
      render body: res.body.to_s, status: res.code.to_i, content_type: "application/json"
    end
  end
end
