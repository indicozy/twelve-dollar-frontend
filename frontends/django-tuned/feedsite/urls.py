"""Routes. No trailing slashes (/login, /posts/250000), so CommonMiddleware's APPEND_SLASH never redirects them."""
from django.urls import path

from web import views

urlpatterns = [
    path("", views.feed, name="feed"),
    path("posts/<int:post_id>", views.post_page, name="post"),
    path("login", views.login, name="login"),
    path("api/posts", views.api_create_post),
    path("api/posts/<int:post_id>/like", views.api_like_post),
]

# Used for every 404 with DEBUG=False: unknown paths, /posts/abc (no URL match) and Http404 from the views.
handler404 = "web.views.not_found"
