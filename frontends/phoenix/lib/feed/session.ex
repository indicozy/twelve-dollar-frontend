defmodule Feed.Session do
  @moduledoc "Demo login token: same HS256 JWT as the other variants (the API has no login endpoint)."

  def sign_token(user_id, username) do
    now = System.system_time(:second)
    head = b64(Jason.encode!(Jason.OrderedObject.new(alg: "HS256", typ: "JWT")))

    body =
      b64(
        Jason.encode!(
          Jason.OrderedObject.new(sub: to_string(user_id), username: username, iat: now, exp: now + 7 * 86_400)
        )
      )

    sig = b64(:crypto.mac(:hmac, :sha256, Application.fetch_env!(:feed, :jwt_secret), "#{head}.#{body}"))
    "#{head}.#{body}.#{sig}"
  end

  @doc "The username from the token payload (not verified, like the JS variants)."
  def username(nil), do: nil

  def username(token) do
    with [_, payload | _] <- String.split(token, "."),
         {:ok, json} <- Base.url_decode64(payload, padding: false),
         {:ok, %{"username" => name}} when is_binary(name) <- Jason.decode(json) do
      name
    else
      _ -> nil
    end
  end

  defp b64(data), do: Base.url_encode64(data, padding: false)
end
