"""Transcribe a recording to JSON with word timings. Usage: transcribe_words.py MEDIA OUT.json"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
VAD = "--vad" in sys.argv
model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, _ = model.transcribe(audio, language="en", word_timestamps=True, vad_filter=VAD, condition_on_previous_text=False)
out = [{"start": s.start, "end": s.end, "text": s.text.strip(),
        "words": [{"w": w.word, "s": w.start, "e": w.end, "p": w.probability} for w in s.words]} for s in segments]
json.dump(out, open(sys.argv[2], "w"), indent=1)
