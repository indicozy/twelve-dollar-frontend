defmodule FeedWeb.PostComponents do
  @moduledoc "The post card, a HEEx function component."
  use Phoenix.Component
  use Phoenix.VerifiedRoutes, endpoint: FeedWeb.Endpoint, router: FeedWeb.Router

  attr :post, :map, required: true
  attr :link, :boolean, default: false

  def post(assigns) do
    ~H"""
    <article class="post" data-post-id={@post["id"]}>
    <header><span class="author">@{@post["author"]}</span><time datetime={@post["created_at"]}>{format_date(@post["created_at"])}</time></header>
    <p>{@post["body"]}</p>
    <footer>
    <.form for={%{}} action={~p"/actions/like"}><input type="hidden" name="id" value={@post["id"]}><button type="submit" class="like">♥ <span>{@post["like_count"]}</span></button></.form>
    <a :if={@link} href={~p"/posts/#{@post["id"]}"}>#{@post["id"]}</a><span :if={!@link} class="muted">#{@post["id"]}</span>
    </footer>
    </article>
    """
  end

  # "Dec 31, 2025, 11:59 PM UTC", like the JS variants' Intl.DateTimeFormat("en", medium/short, UTC) + " UTC".
  def format_date(iso) do
    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} -> Calendar.strftime(DateTime.shift_zone!(dt, "Etc/UTC"), "%b %-d, %Y, %-I:%M %p") <> " UTC"
      _ -> iso
    end
  end
end
