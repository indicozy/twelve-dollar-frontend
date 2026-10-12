"""Flask + Jinja2 variant of the SSR feed app (see ../SPEC.md). Every page is rendered on every request from a fresh
API call; nothing is cached. Served by gunicorn (gunicorn.conf.py): 3 sync worker processes, each running this module.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime
from urllib.parse import quote, urlsplit

import requests
from flask import Flask, Response, abort, redirect, render_template, request

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:4000").rstrip("/")
JWT_SECRET = os.environ.get("JWT_SECRET", "twelve-dollar-challenge").encode()
TOKEN_COOKIE = "token"

app = Flask(__name__)
# Drop the whitespace lines left by {% %} tags. Autoescaping stays on (Flask's default for .html templates).
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True

# ---------------------------------------------------------------------------------------------------------------
# API client: one pooled keep-alive session per worker process (gunicorn imports this module in each worker after
# fork; no preload_app, so no socket is shared between processes). No caching: every call hits the API.
# ---------------------------------------------------------------------------------------------------------------
api = requests.Session()


def _auth(authorization):
    """`authorization` is the full header value ("Bearer <jwt>"), or None to send none."""
    return {"Authorization": authorization} if authorization else {}


def get_feed():
    res = api.get(f"{BACKEND_URL}/feed")
    if res.status_code != 200:
        raise RuntimeError(f"feed: backend returned {res.status_code}")
    return res.json()["posts"]


def get_post(post_id):
    res = api.get(f"{BACKEND_URL}/posts/{quote(post_id, safe='')}")
    if res.status_code in (400, 404):
        return None
    if res.status_code != 200:
        raise RuntimeError(f"post: backend returned {res.status_code}")
    return res.json()["post"]


def create_post(authorization, body):
    return api.post(f"{BACKEND_URL}/posts", json={"body": body}, headers=_auth(authorization))


def like_post(authorization, post_id):
    return api.post(f"{BACKEND_URL}/posts/{quote(post_id, safe='')}/like", headers=_auth(authorization))


# ---------------------------------------------------------------------------------------------------------------
# Demo session: same HS256 token as frontends/sveltekit/src/lib/server/session.ts (the API has no login endpoint).
# ---------------------------------------------------------------------------------------------------------------
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _json(obj) -> bytes:  # same bytes as JSON.stringify
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()


def sign_token(user_id: int, username: str) -> str:
    now = int(time.time())
    head = _b64url(_json({"alg": "HS256", "typ": "JWT"}))
    body = _b64url(_json({"sub": str(user_id), "username": username, "iat": now, "exp": now + 7 * 86400}))
    sig = hmac.new(JWT_SECRET, f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{_b64url(sig)}"


def current_token():
    return request.cookies.get(TOKEN_COOKIE) or None


def current_username():
    """Read from the token cookie's payload on every request (not verified, like the JS variants)."""
    token = current_token()
    if not token:
        return None
    try:
        part = token.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        return payload.get("username") or None
    except Exception:
        return None


@app.context_processor
def inject_username():
    return {"username": current_username()}


# ---------------------------------------------------------------------------------------------------------------
# Date text identical to Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}),
# plus " UTC": "Dec 31, 2025, 11:59 PM UTC". Hand-rolled because strftime pads the day and hour with zeros.
# ---------------------------------------------------------------------------------------------------------------
_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


@app.template_filter("post_date")
def post_date(iso: str) -> str:
    d = datetime.fromisoformat(iso)  # created_at is always UTC ("...Z")
    hour = d.hour % 12 or 12
    return f"{_MONTHS[d.month - 1]} {d.day}, {d.year}, {hour}:{d.minute:02d} {'PM' if d.hour >= 12 else 'AM'} UTC"


# ---------------------------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------------------------
@app.get("/")
def feed():
    # A rejected post comes back as /?error=... (Post/Redirect/Get), like the Nuxt and Angular variants.
    return render_template("index.html", posts=get_feed(), error=request.args.get("error"))


@app.get("/posts/<post_id>")
def post_page(post_id):
    post = get_post(post_id)
    if post is None:
        abort(404)  # the whole page renders before anything is sent, so this is a real 404
    return render_template("post.html", post=post)


@app.get("/login")
def login_page():
    return render_template("login.html")


@app.errorhandler(404)
def not_found(_e):
    return render_template("404.html"), 404


# ---------------------------------------------------------------------------------------------------------------
# HTML form routes (plain form posts, Post/Redirect/Get). Flask has no CSRF/origin protection of its own, so these
# apply the same rule as Next.js server actions and the Nuxt variant: if an Origin header is present, its host must
# equal the Host header, else 403. The JSON routes under /api are not checked, like in the other variants.
# ---------------------------------------------------------------------------------------------------------------
def assert_same_origin():
    origin = request.headers.get("Origin")
    if origin is None:
        return
    try:
        host = urlsplit(origin).netloc
    except ValueError:
        host = None
    if not host or host != request.headers.get("Host"):
        abort(403)


def back_to() -> str:
    """Same-origin path of the page the form was posted from, else /."""
    referer = request.headers.get("Referer")
    if referer:
        try:
            url = urlsplit(referer)
            if url.netloc == request.headers.get("Host") and url.path.startswith("/"):
                return url.path
        except ValueError:
            pass
    return "/"


@app.post("/login")
def login_action():
    assert_same_origin()
    try:
        user_id = int(request.form.get("user_id", ""))
    except ValueError:
        user_id = 0
    username = request.form.get("username", "").strip()
    if user_id < 1 or not username:
        return redirect("/login?error=1", 303)
    res = redirect("/", 303)
    res.set_cookie(TOKEN_COOKIE, sign_token(user_id, username), httponly=True, samesite="Lax", path="/")
    return res


@app.post("/actions/create")
def create_action():
    assert_same_origin()
    token = current_token()
    if not token:
        return redirect("/login", 303)
    res = create_post(f"Bearer {token}", request.form.get("body", ""))
    if res.status_code != 201:
        error = res.json().get("error") or f"error {res.status_code}"
        return redirect(f"/?error={quote(error, safe='')}", 303)
    return redirect("/", 303)


@app.post("/actions/like")
def like_action():
    assert_same_origin()
    token = current_token()
    if not token:
        return redirect("/login", 303)
    like_post(f"Bearer {token}", request.form.get("id", ""))
    return redirect(back_to(), 303)


# ---------------------------------------------------------------------------------------------------------------
# JSON passthrough for the load test: forward Authorization as-is, return the API's status and JSON body unchanged.
# ---------------------------------------------------------------------------------------------------------------
def _passthrough(res: requests.Response) -> Response:
    return Response(res.content, status=res.status_code, content_type="application/json")


def _js_string(value) -> str:
    """String(value ?? '') for a JSON value, as the JS variants do."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


@app.post("/api/posts")
def api_create():
    # Strict parse: request.get_json(silent=True) would turn bad JSON into None, indistinguishable from `null`.
    try:
        data = json.loads(request.get_data())
    except ValueError:
        return {"error": "malformed JSON body"}, 400
    if data is None:  # `null.body` throws in JS
        return {"error": "malformed JSON body"}, 400
    body = _js_string(data.get("body")) if isinstance(data, dict) else ""
    return _passthrough(create_post(request.headers.get("Authorization"), body))


@app.post("/api/posts/<post_id>/like")
def api_like(post_id):
    return _passthrough(like_post(request.headers.get("Authorization"), post_id))
