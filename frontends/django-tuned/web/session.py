"""Demo login tokens (the API has no login endpoint) and reading the `token` cookie.

Same HS256 JWT as frontends/sveltekit/src/lib/server/session.ts and the challenge's seed/tokens.json.
"""
import base64
import hashlib
import hmac
import json
import time

from django.conf import settings

TOKEN_COOKIE = "token"
_HEADER = {"alg": "HS256", "typ": "JWT"}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _json(obj: dict) -> bytes:
    # Compact like JSON.stringify (key order is insertion order, as in the JS variants).
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()


def sign_token(user_id: int, username: str) -> str:
    now = int(time.time())
    head = _b64url(_json(_HEADER))
    body = _b64url(_json({"sub": str(user_id), "username": username, "iat": now, "exp": now + 7 * 86400}))
    sig = hmac.new(settings.JWT_SECRET.encode(), f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{_b64url(sig)}"


def current_token(request) -> str | None:
    return request.COOKIES.get(TOKEN_COOKIE) or None


def current_username(request) -> str | None:
    """The `username` claim of the token cookie (not verified; the API verifies the token on writes)."""
    token = current_token(request)
    if not token:
        return None
    try:
        part = token.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        username = payload.get("username")
        return username if isinstance(username, str) and username else None
    except (IndexError, ValueError, AttributeError):
        return None
