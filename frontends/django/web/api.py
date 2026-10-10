"""Server-side API client. No caching: every call hits the API.

One requests.Session per process (module level): gunicorn imports the app in each worker after forking (no
--preload), so every worker gets its own pooled keep-alive connection to the API. A sync worker handles one request
at a time, so it only ever uses one connection from the pool.
"""
import requests
from django.conf import settings

_session = requests.Session()


def _url(path: str) -> str:
    return settings.BACKEND_URL + path


def _auth(authorization: str | None) -> dict[str, str]:
    """`authorization` is the full header value ("Bearer <jwt>"), or None to send none."""
    return {"Authorization": authorization} if authorization else {}


def get_feed() -> list[dict]:
    res = _session.get(_url("/feed"))
    if res.status_code != 200:
        raise RuntimeError(f"feed: backend returned {res.status_code}")
    return res.json()["posts"]


def get_post(post_id: int) -> dict | None:
    res = _session.get(_url(f"/posts/{post_id}"))
    if res.status_code in (400, 404):
        return None
    if res.status_code != 200:
        raise RuntimeError(f"post: backend returned {res.status_code}")
    return res.json()["post"]


def create_post(authorization: str | None, body: str) -> requests.Response:
    # json= serializes the body and sets Content-Type: application/json
    return _session.post(_url("/posts"), json={"body": body}, headers=_auth(authorization))


def like_post(authorization: str | None, post_id: int) -> requests.Response:
    return _session.post(_url(f"/posts/{post_id}/like"), headers=_auth(authorization))
