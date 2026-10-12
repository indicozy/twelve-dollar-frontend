from datetime import datetime, timezone

from django import template

register = template.Library()

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


@register.filter(is_safe=True)
def utc_medium(value: str) -> str:
    """Format like the JS variants' Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short",
    timeZone: "UTC"}) plus " UTC": "Dec 31, 2025, 11:59 PM UTC", "Jan 5, 2026, 9:05 AM UTC".

    Done by hand: Django's `date` filter writes "p.m." and strftime pads hours/days with zeros. Node 24's ICU puts
    a plain space before AM/PM (checked byte for byte), so this does too.
    """
    dt = datetime.fromisoformat(value).astimezone(timezone.utc)
    hour = dt.hour % 12 or 12
    ampm = "AM" if dt.hour < 12 else "PM"
    return f"{_MONTHS[dt.month - 1]} {dt.day}, {dt.year}, {hour}:{dt.minute:02d} {ampm} UTC"
