class SessionsController < ApplicationController
  def new; end

  def create
    id = Integer(params[:user_id].to_s.strip, 10, exception: false)
    username = params[:username].to_s.strip
    return redirect_to("/login?error=1", status: :see_other) if id.nil? || id < 1 || username.empty?

    cookies[:token] = { value: DemoToken.sign(id, username), httponly: true, same_site: :lax, path: "/" }
    redirect_to root_path, status: :see_other
  end
end
