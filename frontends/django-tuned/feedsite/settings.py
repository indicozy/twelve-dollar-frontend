"""Minimal production Django settings: no database, no sessions/auth/admin, DEBUG always off.

All data comes from the Rust API (BACKEND_URL); see README.md for what each piece costs per request.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# Benchmark-only default (public, in the repo): set DJANGO_SECRET_KEY for anything real. This app signs nothing with
# it (no sessions or signed cookies; CSRF tokens are random values compared with the CSRF cookie).
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-benchmark-only-key-do-not-use-in-production-2b7f9c41e8a6"
)

# Always off in production (there is deliberately no env switch for it).
DEBUG = False

# The sim's load generator sends Host: web:3000; browsers use localhost:3000 or 127.0.0.1:3000.
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,web")
# Form posts over plain http. Django already accepts an Origin equal to the request's own scheme+host; listing them
# explicitly documents the expected origins (and covers a proxy that rewrites Host).
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://web:3000"
)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:4000").rstrip("/")
JWT_SECRET = os.environ.get("JWT_SECRET", "twelve-dollar-challenge")

INSTALLED_APPS = [
    "django.contrib.staticfiles",  # collectstatic + the {% static %} tag
    "web",
]

# No session/auth/message middleware: they need the apps (and a DB) that are not installed.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # right after SecurityMiddleware, as WhiteNoise documents
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "feedsite.urls"
WSGI_APPLICATION = "feedsite.wsgi.application"

TEMPLATES = [
    {
        # django-tuned: Django's built-in Jinja2 backend instead of the Django template language. Jinja2 compiles each
        # template to Python bytecode once per worker; the Django template language walks a node tree per render, and
        # in ../django that walk was ~30% of the CPU (perf, 1,000 users). Templates live in web/jinja2/.
        "BACKEND": "django.template.backends.jinja2.Jinja2",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "environment": "feedsite.jinja2_env.environment",
            "context_processors": ["web.context_processors.current_user"],
        },
    }
]

# No database: every page reads the API. Django falls back to its dummy backend, which errors if anything queries.
DATABASES = {}

# The app has no translations; skip the i18n machinery (startproject's default is True).
USE_I18N = False
USE_TZ = True
TIME_ZONE = "UTC"

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]  # static/styles.css: verbatim copy of ../shared/styles.css
STATIC_ROOT = BASE_DIR / "staticfiles"  # written by collectstatic (at docker build time), gitignored
STORAGES = {
    # Hashed file names (styles.<hash>.css, served with a 1-year immutable cache-control) plus pre-gzipped copies
    # made at collectstatic time, so serving the CSS costs no compression at runtime.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Security headers (defaults, listed for visibility): X-Content-Type-Options: nosniff, Referrer-Policy: same-origin,
# Cross-Origin-Opener-Policy: same-origin (SecurityMiddleware); X-Frame-Options: DENY (XFrameOptionsMiddleware).
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# The benchmark is plain http (no TLS anywhere), so no HSTS, SSL redirect or Secure cookies; see README.md.
CSRF_COOKIE_SECURE = False
CSRF_COOKIE_HTTPONLY = False  # Django's default; the token in the page is what forms submit anyway
