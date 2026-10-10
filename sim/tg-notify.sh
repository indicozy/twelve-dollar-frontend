#!/usr/bin/env bash
# Sends one Telegram message: bash sim/tg-notify.sh "text". Bot token + chat id live outside the repo in
# ~/.config/perf-telegram.env (TG_TOKEN=..., TG_CHAT=...); does nothing if that file is missing.
f="$HOME/.config/perf-telegram.env"; [ -f "$f" ] || exit 0
. "$f"
curl -s -m 20 -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" -d chat_id="$TG_CHAT" \
  --data-urlencode text="$1" -o /dev/null -w '%{http_code}'
