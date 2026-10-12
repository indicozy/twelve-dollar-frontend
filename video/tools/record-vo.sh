#!/usr/bin/env bash
# Record a free voice-over take while the video plays, then transcribe it with timestamps.
# Usage: tools/record-vo.sh [take-name]    (run from perf/video)
# Playback and recording start together, so transcript times line up with the video.
# Close the video window (or press q in it) to stop. Wear headphones so the mic doesn't catch the video.
set -euo pipefail
cd "$(dirname "$0")/.."
take="${1:-take-$(date +%H%M%S)}"
mkdir -p recordings
wav="recordings/$take.wav"

pw-record --rate 48000 --channels 1 "$wav" &
rec=$!
sleep 0.3
ffplay -autoexit -loglevel error -window_title "voice-over: $take (q to stop)" out/full-v3d-1440p.mp4 || true
kill -INT "$rec"; wait "$rec" 2>/dev/null || true

echo "Saved $wav, transcribing..."
.venv-asr/bin/python tools/transcribe_vo.py "$wav" "recordings/$take.txt"
echo "Transcript: recordings/$take.txt"
