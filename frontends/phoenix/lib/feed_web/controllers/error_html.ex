defmodule FeedWeb.ErrorHTML do
  @moduledoc "Errors raised outside the pages (500, unknown non-GET paths): plain status text, as the generator does."
  use FeedWeb, :html

  def render(template, _assigns), do: Phoenix.Controller.status_message_from_template(template)
end
