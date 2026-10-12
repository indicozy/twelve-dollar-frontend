"""Transcribe a voice-over take and group it under the video's cues. Usage: transcribe_vo.py WAV OUT"""
import re
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

cues = [(int(m[2]) * 60 + int(m[3]), m[1])
        for m in re.finditer(r'^## \d+\. (.+?) \((\d+):(\d+)', open('VOICEOVER-long.md').read(), re.M)]

# Decode with ffmpeg ourselves; the bundled PyAV rejects faster-whisper's open() arguments.
pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, _ = model.transcribe(audio, language="en", word_timestamps=True, vad_filter=True)

by_cue = {i: [] for i in range(len(cues))}
lines = []
for seg in segments:
    for w in seg.words:
        i = max(j for j, (t, _) in enumerate(cues) if t <= w.start or j == 0)
        by_cue[i].append(w.word)
    lines.append(f"[{seg.start:6.1f}-{seg.end:6.1f}] {seg.text.strip()}")

with open(sys.argv[2], "w") as f:
    for i, (t, title) in enumerate(cues):
        f.write(f"## {title} ({t // 60}:{t % 60:02d})\n{''.join(by_cue[i]).strip()}\n\n")
    f.write("# Raw segments\n" + "\n".join(lines) + "\n")
