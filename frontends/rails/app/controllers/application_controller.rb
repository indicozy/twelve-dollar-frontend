class ApplicationController < ActionController::Base
  # CSRF: ActionController::Base already does `protect_from_forgery with: :exception` (Rails default): every
  # non-GET request needs the form's authenticity_token (kept in the cookie session) and, if an Origin header is
  # present, it must match the request's base URL. Failures are 422.
  # (The generated `allow_browser versions: :modern` is removed: no browser gating in the other variants.)

  helper_method :current_username

  skip_forgery_protection only: :not_found

  # Unknown paths (catch-all route) and missing posts: the 404 page with the layout.
  def not_found
    render "application/not_found", status: :not_found, formats: :html
  end

  private

  # The raw JWT in the `token` cookie (unsigned/unencrypted, so the seed tokens work too).
  def current_token = cookies[:token].presence

  def current_username
    return @current_username if defined?(@current_username)
    @current_username = DemoToken.username(current_token)
  end

  def require_token
    redirect_to login_path, status: :see_other unless current_token
  end
end
