defmodule FeedWeb.Router do
  use FeedWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :put_root_layout, html: {FeedWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :assign_user
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", FeedWeb do
    pipe_through :api
    post "/posts", ApiController, :create
    post "/posts/:id/like", ApiController, :like
  end

  scope "/", FeedWeb do
    pipe_through :browser

    get "/", PageController, :index
    get "/posts/:id", PageController, :show
    get "/login", PageController, :login
    post "/login", PageController, :sign_in
    post "/actions/create", ActionController, :create
    post "/actions/like", ActionController, :like
    get "/*path", PageController, :not_found
  end

  # The `token` cookie and the signed-in name (the header shows @username).
  defp assign_user(conn, _opts) do
    token = conn.req_cookies["token"]
    conn |> assign(:token, token) |> assign(:username, Feed.Session.username(token))
  end
end
