class PostsController < ApplicationController
  def show
    @post = FeedApi.post(params[:id])
    # The whole page renders before anything is sent, so a missing post is a real 404.
    not_found unless @post
  end
end
