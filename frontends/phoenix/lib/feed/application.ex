defmodule Feed.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    # Req starts its own Finch pool (Req.Finch) under the :req application: pooled keep-alive HTTP/1 connections.
    children = [FeedWeb.Endpoint]
    Supervisor.start_link(children, strategy: :one_for_one, name: Feed.Supervisor)
  end
end
