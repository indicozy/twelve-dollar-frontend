from .session import current_username


def current_user(request):
    """The header's `@username`: read from the token cookie on every request (lazily, only when rendered)."""
    return {"username": lambda: current_username(request)}
