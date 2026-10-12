class FeedController < ApplicationController
  before_action :require_token, only: %i[create like]

  def index
    @posts = FeedApi.feed
    # A rejected post comes back as /?error=... (Post/Redirect/Get), like the Express and Flask variants.
    @error = params[:error].presence if params[:error].is_a?(String)
  end

  def create
    res = FeedApi.create_post("Bearer #{current_token}", params[:body].to_s)
    return redirect_to(root_path, status: :see_other) if res.code == "201"

    message = begin
      JSON.parse(res.body)["error"]
    rescue StandardError
      nil
    end
    redirect_to root_path(error: message || "error #{res.code}"), status: :see_other
  end

  def like
    FeedApi.like_post("Bearer #{current_token}", params[:id].to_s)
    # Back to the page the form was posted from (same host only, else /).
    redirect_back_or_to root_path, status: :see_other
  end
end
