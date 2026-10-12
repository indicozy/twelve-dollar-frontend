"""Map chunks cut from an already-cut take back to the source timeline.
Usage: compose_chunks.py FIRST.json SECOND.json OUT.json (SECOND is on the timeline FIRST produces)"""
import json
import sys

first, second = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
starts, t = [], 0.0
for a, b in first:            # where each first-pass chunk begins on the cut timeline
    starts.append(t); t += b - a
out = []
for a, b in second:
    for (fa, fb), ts in zip(first, starts):
        te = ts + (fb - fa)
        lo, hi = max(a, ts), min(b, te)
        if hi > lo:
            out.append([fa + lo - ts, fa + hi - ts])
json.dump(out, open(sys.argv[3], "w"))
print(f"{len(out)} chunks, {sum(b - a for a, b in out) / 60:.2f} min")
