defmodule Feed.Api do
  @moduledoc """
  API client. Req over its default Finch pool (keep-alive connections to the API). No caching: every call hits
  the API. `retry: false` so a failed call surfaces as an error, like the other variants' fetch.
  """

  defp req(opts) do
    Req.new([base_url: Application.fetch_env!(:feed, :backend_url), retry: false] ++ opts)
  end

  defp auth(nil), do: []
  defp auth(authorization), do: [{"authorization", authorization}]

  def get_feed do
    case Req.get!(req(url: "/feed")) do
      %{status: 200, body: %{"posts" => posts}} -> posts
      %{status: status} -> raise "feed: backend returned #{status}"
    end
  end

  def get_post(id) do
    case Req.get!(req(url: "/posts/#{URI.encode(id, &URI.char_unreserved?/1)}")) do
      %{status: 200, body: %{"post" => post}} -> post
      %{status: status} when status in [400, 404] -> nil
      %{status: status} -> raise "post: backend returned #{status}"
    end
  end

  @doc "Returns the raw Req response (body not decoded): callers decode it or pass the bytes through."
  def create_post(authorization, body) do
    Req.post!(
      req(
        url: "/posts",
        headers: auth(authorization) ++ [{"content-type", "application/json"}],
        body: Jason.encode_to_iodata!(%{body: body}),
        decode_body: false
      )
    )
  end

  def like_post(authorization, id) do
    Req.post!(
      req(
        url: "/posts/#{URI.encode(id, &URI.char_unreserved?/1)}/like",
        headers: auth(authorization),
        decode_body: false
      )
    )
  end
end
