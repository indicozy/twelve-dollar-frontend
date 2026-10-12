"""Re-transcribe the gaps (> MIN s) between segments of a transcript JSON, to catch skipped speech.
Usage: transcribe_gaps.py MEDIA TRANSCRIPT.json"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

MIN = 4.0
pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
segs = json.load(open(sys.argv[2]))
edges = [0.0] + [x for s in segs for x in (s["start"], s["end"])] + [len(audio) / 16000]
gaps = [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2) if edges[i + 1] - edges[i] > MIN]
model = WhisperModel("large-v3", device="cuda", compute_type="float16")
for a, b in gaps:
    part = audio[int(a * 16000):int(b * 16000)]
    rms = float(np.sqrt(np.mean(part ** 2)) + 1e-9)
    out, _ = model.transcribe(part, language="en", vad_filter=True, condition_on_previous_text=False)
    text = " ".join(f"[{a + s.start:.1f}] {s.text.strip()}" for s in out)
    print(f"gap {a:7.1f}-{b:7.1f} ({b - a:4.1f}s, {20 * np.log10(rms):5.1f} dB): {text or '-'}")
