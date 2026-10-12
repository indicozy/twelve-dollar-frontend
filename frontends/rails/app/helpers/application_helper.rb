module ApplicationHelper
  # "Dec 31, 2025, 11:59 PM UTC", like the JS variants' Intl.DateTimeFormat("en", {dateStyle: "medium",
  # timeStyle: "short", timeZone: "UTC"}) + " UTC".
  def post_time(iso)
    Time.iso8601(iso).utc.strftime("%b %-d, %Y, %-l:%M %p UTC")
  end
end
