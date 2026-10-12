defmodule FeedWeb.ApiController do
  @moduledoc "JSON passthrough for the load test: forwards Authorization as-is, returns the API's status and bytes."
  use FeedWeb, :controller

  def create(conn, _params) do
    # Strict parse of the raw body (any content type); invalid JSON, empty body or null -> 400.
    {:ok, raw, conn} = read_body(conn)

    case Jason.decode(raw) do
      {:ok, %{} = json} ->
        body = json["body"]
        text = if is_binary(body), do: body, else: if(is_nil(body), do: "", else: Jason.encode!(body))
        passthrough(conn, Feed.Api.create_post(authorization(conn), text))

      _ ->
        conn |> put_status(400) |> json(%{error: "malformed JSON body"})
    end
  end

  def like(conn, %{"id" => id}), do: passthrough(conn, Feed.Api.like_post(authorization(conn), id))

  defp authorization(conn), do: List.first(get_req_header(conn, "authorization"))

  defp passthrough(conn, %{status: status, body: body}) do
    conn |> put_resp_content_type("application/json") |> send_resp(status, body)
  end
end
