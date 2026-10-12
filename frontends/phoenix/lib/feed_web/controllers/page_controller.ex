defmodule FeedWeb.PageController do
  use FeedWeb, :controller

  def index(conn, params) do
    # A rejected post comes back as /?error=... (Post/Redirect/Get), like the Express and Flask variants.
    error = if is_binary(params["error"]), do: params["error"]
    render(conn, :index, posts: Feed.Api.get_feed(), error: error)
  end

  def show(conn, %{"id" => id}) do
    # The whole page renders before anything is sent, so a missing post is a real 404.
    case Feed.Api.get_post(id) do
      nil -> not_found(conn, %{})
      post -> render(conn, :show, post: post)
    end
  end

  def login(conn, _params), do: render(conn, :login)

  def sign_in(conn, params) do
    username = String.trim(to_string(params["username"] || ""))

    case Integer.parse(to_string(params["user_id"] || "")) do
      {id, ""} when id >= 1 and username != "" ->
        conn
        |> put_resp_cookie("token", Feed.Session.sign_token(id, username), http_only: true, same_site: "Lax", path: "/")
        |> put_status(303)
        |> redirect(to: ~p"/")

      _ ->
        conn |> put_status(303) |> redirect(to: ~p"/login?error=1")
    end
  end

  def not_found(conn, _params), do: conn |> put_status(404) |> render(:not_found)
end
