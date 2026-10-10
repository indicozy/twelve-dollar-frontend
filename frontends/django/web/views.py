"""Views. Pages are rendered on every request from a fresh API call; nothing is cached.

Forms post back to the page they are on (`?create`, `?like`, like SvelteKit's `?/create`), are protected by Django's
CSRF middleware, forward the `token` cookie to the API as a bearer token, then answer 303 (Post/Redirect/Get).
"""
import json
from urllib.parse import quote

from django.http import Http404, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from . import api
from .session import TOKEN_COOKIE, current_token, sign_token


def _see_other(to: str) -> HttpResponseRedirect:
    return HttpResponseRedirect(to, status=303)


def _like(request) -> HttpResponseRedirect:
    """The like form on every post card (feed and post page): redirect back to the same page."""
    token = current_token(request)
    if not token:
        return _see_other("/login")
    try:
        post_id = int(request.POST.get("id", ""))
    except ValueError:
        return _see_other(request.path)
    api.like_post(f"Bearer {token}", post_id)  # 201 liked / 200 already liked: either way show the count again
    return _see_other(request.path)


@require_http_methods(["GET", "HEAD", "POST"])
def feed(request):
    if request.method == "POST":
        if "like" in request.GET:
            return _like(request)
        token = current_token(request)
        if not token:
            return _see_other("/login")
        res = api.create_post(f"Bearer {token}", request.POST.get("body", ""))
        if res.status_code != 201:
            # A rejected post (e.g. empty or too long) shows the API's error on the feed, via the redirect's query.
            error = res.json().get("error") or f"error {res.status_code}"
            return _see_other(f"/?error={quote(error)}")
        return _see_other("/")
    return render(request, "feed.html", {"posts": api.get_feed(), "error": request.GET.get("error")})


@require_http_methods(["GET", "HEAD", "POST"])
def post_page(request, post_id: int):
    if request.method == "POST":
        return _like(request)
    # The post is fetched before anything is rendered, so a missing post is a real 404 (handler404 below).
    post = api.get_post(post_id)
    if post is None:
        raise Http404("post not found")
    return render(request, "post.html", {"post": post})


@require_http_methods(["GET", "HEAD", "POST"])
def login(request):
    if request.method == "POST":
        try:
            user_id = int(request.POST.get("user_id", ""))
        except ValueError:
            user_id = 0
        username = request.POST.get("username", "").strip()
        if user_id < 1 or not username:
            return _see_other("/login?error=1")
        res = _see_other("/")
        res.set_cookie(TOKEN_COOKIE, sign_token(user_id, username), httponly=True, samesite="Lax", path="/")
        return res
    return render(request, "login.html")


def not_found(request, exception=None):
    """handler404: the site's not-found page (with the header) for every 404 when DEBUG=False."""
    return render(request, "404.html", status=404)


# JSON passthrough routes for the load test's writes. No CSRF (no cookies involved: the caller sends Authorization).


def _passthrough(res) -> HttpResponse:
    """The API's status and JSON body, byte for byte."""
    return HttpResponse(res.content, status=res.status_code, content_type="application/json")


def _reject_constant(name: str):
    raise ValueError(f"invalid JSON constant {name}")


@csrf_exempt
@require_POST
def api_create_post(request):
    try:
        # Strict: valid UTF-8 JSON only (Python's json would otherwise accept NaN/Infinity).
        data = json.loads(request.body, parse_constant=_reject_constant)
        if data is None:
            raise ValueError("null body")
    except ValueError:
        return JsonResponse({"error": "malformed JSON body"}, status=400, json_dumps_params={"separators": (",", ":")})
    body = data.get("body") if isinstance(data, dict) else None
    if body is None:
        body = ""
    elif not isinstance(body, str):
        body = json.dumps(body)
    return _passthrough(api.create_post(request.headers.get("Authorization"), body))


@csrf_exempt
@require_POST
def api_like_post(request, post_id: int):
    return _passthrough(api.like_post(request.headers.get("Authorization"), post_id))
