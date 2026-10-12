"""Jinja2 environment for Django's built-in Jinja2 template backend (django.template.backends.jinja2.Jinja2).

Same globals/filters the Django-template version used: `static` (the hashed URL from the staticfiles manifest) and the
`utc_medium` date filter. Django adds `request`, `csrf_input` and `csrf_token` to every context itself.
"""
from django.templatetags.static import static
from jinja2 import Environment

from web.templatetags.feed_tags import utc_medium


def environment(**options):
    env = Environment(**options)
    env.globals["static"] = static
    env.filters["utc_medium"] = utc_medium
    return env
