"""Build the kept-speech chunks for a take: drop words inside the cut ranges, then close every pause.
Usage: cut_take.py TRANSCRIPT.json CUTS.py OUT.json  -> list of [start, end] chunks in source seconds"""
import json
import runpy
import sys

PAD_IN, PAD_OUT, JOIN = 0.08, 0.16, 0.35   # lead-in, tail, and the longest pause kept inside a chunk
words = [w for s in json.load(open(sys.argv[1])) for w in s["words"]]
cuts = runpy.run_path(sys.argv[2])["CUTS"]
cut = [any(a <= w["s"] < b for a, b, _ in cuts) for w in words]
kept = [w for w, c in zip(words, cut) if not c]
chunks = []
for i, w in enumerate(words):
    if cut[i]:
        continue
    # pads never reach into a neighbouring removed word
    lo = words[i - 1]["e"] if i and cut[i - 1] else 0
    hi = words[i + 1]["s"] if i + 1 < len(words) and cut[i + 1] else float("inf")
    s, e = max(lo, w["s"] - PAD_IN), min(hi, w["e"] + PAD_OUT)
    if chunks and not cut[i - 1] and s - chunks[-1][1] < JOIN:
        chunks[-1][1] = max(chunks[-1][1], e)
    else:
        chunks.append([s, e])
json.dump(chunks, open(sys.argv[3], "w"))
total = sum(b - a for a, b in chunks)
print(f"{len(kept)} words kept of {len(words)}; {len(chunks)} chunks; {total / 60:.2f} min ({int(total // 60)}:{int(total % 60):02d})")
