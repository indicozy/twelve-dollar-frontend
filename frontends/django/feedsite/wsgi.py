"""WSGI entry point: `gunicorn feedsite.wsgi` (see gunicorn.conf.py)."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "feedsite.settings")

application = get_wsgi_application()
