defmodule FeedWeb do
  @moduledoc "Entry point for the web interface (controllers, components, router), as `mix phx.new` lays it out."

  def static_paths, do: ~w(styles.css)

  def router do
    quote do
      use Phoenix.Router, helpers: false
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:html, :json]
      import Plug.Conn
      unquote(verified_routes())
    end
  end

  def html do
    quote do
      use Phoenix.Component
      import Phoenix.Controller, only: [get_csrf_token: 0]
      import Phoenix.HTML
      import FeedWeb.PostComponents
      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: FeedWeb.Endpoint,
        router: FeedWeb.Router,
        statics: FeedWeb.static_paths()
    end
  end

  defmacro __using__(which) when is_atom(which), do: apply(__MODULE__, which, [])
end
