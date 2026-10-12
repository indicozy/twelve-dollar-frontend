defmodule Feed.MixProject do
  use Mix.Project

  def project do
    [
      app: :feed,
      version: "0.1.0",
      elixir: "~> 1.18",
      elixirc_paths: ["lib"],
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: [feed: [include_executables_for: [:unix]]]
    ]
  end

  def application do
    [mod: {Feed.Application, []}, extra_applications: [:logger, :crypto]]
  end

  # Exact pins (mix.lock is committed too). phoenix_live_view is only here for Phoenix.Component / HEEx
  # (function components, <.form>); no LiveView socket is mounted.
  defp deps do
    [
      {:phoenix, "1.8.15"},
      {:phoenix_html, "4.3.0"},
      {:phoenix_live_view, "1.2.12"},
      {:bandit, "1.12.5"},
      {:req, "0.7.5"},
      {:jason, "1.4.5"}
    ]
  end
end
