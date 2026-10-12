"""Render the kept chunks of a take. Usage: render_take.py MEDIA CHUNKS.json OUT.(wav|mp4)
Audio gets 10 ms fades at each cut so the joins don't click; .mp4 also cuts the video (NVENC if available)."""
import json
import subprocess
import sys

src, chunks, out = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
video = out.endswith(".mp4")
parts, labels = [], []
for i, (a, b) in enumerate(chunks):
    d = b - a
    parts.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={max(0, d - 0.01):.3f}:d=0.01[a{i}]")
    labels.append(f"[a{i}]")
    if video:
        parts.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{i}]")
        labels[-1] = f"[v{i}][a{i}]"
n = len(chunks)
parts.append("".join(labels) + (f"concat=n={n}:v=1:a=1[v][a]" if video else f"concat=n={n}:v=0:a=1[a]"))
graph = ";".join(parts)
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-stats", "-i", src, "-filter_complex", graph, "-map", "[a]"]
if video:
    cmd += ["-map", "[v]", "-c:v", "h264_nvenc", "-preset", "p5", "-cq", "21", "-c:a", "aac", "-b:a", "192k"]
else:
    cmd += ["-ac", "1", "-ar", "48000"]
subprocess.run(cmd + [out], check=True)
