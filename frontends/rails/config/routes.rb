Rails.application.routes.draw do
  # format: false everywhere: "/posts/1.json" is not a post page, and unknown paths render the HTML 404 page.
  scope format: false do
    root "feed#index"
    get "posts/:id", to: "posts#show", as: :post
    get "login", to: "sessions#new"
    post "login", to: "sessions#create"

    # HTML form posts (CSRF token + Origin check, Post/Redirect/Get).
    post "actions/create", to: "feed#create", as: :create_post
    post "actions/like", to: "feed#like", as: :like_post

    # JSON passthrough for the load test (ActionController::API: no CSRF, no cookies, no views).
    post "api/posts", to: "api/posts#create"
    post "api/posts/:id/like", to: "api/posts#like"

    # Everything else: the 404 page (with the layout, so the header still shows the signed-in user).
    match "*path", to: "application#not_found", via: :all
  end
end
