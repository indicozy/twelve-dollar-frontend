defmodule FeedWeb.ActionController do
  @moduledoc "HTML form posts (Post/Redirect/Get, 303). CSRF: Phoenix's protect_from_forgery in the :browser pipeline."
  use FeedWeb, :controller

  def create(%{assigns: %{token: nil}} = conn, _), do: see_other(conn, ~p"/login")

  def create(conn, params) do
    case Feed.Api.create_post("Bearer #{conn.assigns.token}", to_string(params["body"] || "")) do
      %{status: 201} ->
        see_other(conn, ~p"/")

      %{status: status, body: body} ->
        message =
          case Jason.decode(body) do
            {:ok, %{"error" => msg}} when is_binary(msg) -> msg
            _ -> "error #{status}"
          end

        see_other(conn, ~p"/?#{[error: message]}")
    end
  end

  def like(%{assigns: %{token: nil}} = conn, _), do: see_other(conn, ~p"/login")

  def like(conn, params) do
    Feed.Api.like_post("Bearer #{conn.assigns.token}", to_string(params["id"] || ""))
    see_other(conn, back_to(conn))
  end

  defp see_other(conn, to), do: conn |> put_status(303) |> redirect(to: to)

  # Same-origin path of the page the form was posted from, else /.
  defp back_to(conn) do
    with [referer | _] <- get_req_header(conn, "referer"),
         %URI{host: host, port: port, path: "/" <> _ = path} <- URI.parse(referer),
         [req_host | _] <- get_req_header(conn, "host"),
         true <- String.downcase(req_host) in [String.downcase("#{host}:#{port}"), String.downcase(host || "")] do
      path
    else
      _ -> "/"
    end
  end
end
