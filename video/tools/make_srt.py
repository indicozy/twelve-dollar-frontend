"""YouTube subtitles from a word-timed transcript. Usage: make_srt.py WORDS.json OUT.srt [FIXES.json]
Cues are at most two lines of 42 characters and 6 seconds, broken at sentence ends and pauses."""
import json
import re
import sys

MAX_LINE, MAX_SECS, PAUSE = 42, 6.0, 0.6

# Names Whisper keeps mishearing in these takes.
FIXES = [
    (r"\bHANA\b|\bHonor\b|\bhonor\b|\bHono R\b", "Hono"), (r"\bBAN\b|\bban\b|\bBun\b", "Bun"),
    (r"\bNexGest\b|\bNext Gest\b|\bNextJS\b|\bNext\.JS\b|\bnext\.js\b|\bnext just\b|\bNick\b", "Next.js"),
    (r"\bplain\.js\b|\bPlain\.js\b|\bPlaying\.exe\b", "plain Next.js"),
    (r"\bNunchucks\b|\bnon-junk\b|\bnon-jax\b|\bnunjucks\b", "Nunjucks"),
    (r"\b10stack\b|\b10 stack\b|\bTenStack\b|\bTester\b", "TanStack"), (r"\bQuik\b", "Qwik"),
    (r"\bSELT\b|\bSvelte Kit\b", "SvelteKit"), (r"\brath\b|\brushed\b|\bruss\b|\bRuss\b|\brust\b", "Rust"),
    (r"\bk6\b", "K6"), (r"\bp95\b", "P95"), (r"\bp99\b", "P99"), (r"\bfeet a second\b", "feeds a second"),
    (r"\bjavascript\b|\bJavascript\b", "JavaScript"), (r"\bginger\b", "Jinja"), (r"\bIntelliRebel\b", "Laravel"),
]

# Optional take-specific corrections: a JSON list of [regex, replacement], applied to each cue.
EXTRA = [tuple(x) for x in json.load(open(sys.argv[3]))] if len(sys.argv) > 3 else []

def fix(text):
    for pat, rep in FIXES + EXTRA:
        text = re.sub(pat, rep, text)
    return text

def ts(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

def wrap(text):
    if len(text) <= MAX_LINE:
        return text
    words = text.split()
    best = min(range(1, len(words)), key=lambda i: abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))))
    return " ".join(words[:best]) + "\n" + " ".join(words[best:])

words = []
for w in (w for seg in json.load(open(sys.argv[1])) for w in seg["words"]):
    if w["p"] < 0.2 and w["e"] - w["s"] < 0.15:  # Whisper's made-up words at cut points ("tags.", "pages.")
        continue
    if words and not w["w"].startswith(" "):  # ".js" split off "Next" and the like
        words[-1] = {**words[-1], "w": words[-1]["w"] + w["w"], "e": w["e"]}
    else:
        words.append(dict(w))

def sentence_end_within(i, n):
    """Index of the word ending the sentence within the next n words, if any."""
    for j in range(i + 1, min(i + 1 + n, len(words))):
        if words[j]["w"].strip().endswith((".", "?", "!")):
            return j
    return None

cues, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    text = "".join(x["w"] for x in cur).strip()
    nxt = words[i + 1] if i + 1 < len(words) else None
    end_sentence = text.endswith((".", "?", "!"))
    gap = nxt["s"] - w["e"] if nxt else 99
    too_long = nxt and (len(text + nxt["w"]) > 2 * MAX_LINE or nxt["e"] - cur[0]["s"] > MAX_SECS)
    if too_long:
        # don't leave two or three words of a sentence alone on the next cue
        j = sentence_end_within(i, 3)
        if j is not None and len(text + "".join(x["w"] for x in words[i + 1:j + 1])) <= 2 * MAX_LINE + 16:
            continue
        # otherwise break after the last comma, if that leaves a reasonable cue
        k = max((n for n, x in enumerate(cur[:-1]) if x["w"].strip().endswith(",")), default=-1)
        if k >= 3:
            cues.append((cur[0]["s"], cur[k]["e"], "".join(x["w"] for x in cur[:k + 1]).strip()))
            cur = cur[k + 1:]
            continue
    if not nxt or end_sentence or gap > PAUSE or too_long:
        cues.append((cur[0]["s"], w["e"], text))
        cur = []

with open(sys.argv[2], "w") as f:
    for n, (s, e, text) in enumerate(cues, 1):
        e = min(max(e, s + 0.8), cues[n][0] if n < len(cues) else e + 0.8)  # at least 0.8 s on screen, no overlap
        f.write(f"{n}\n{ts(s)} --> {ts(e)}\n{wrap(fix(text))}\n\n")
print(f"{len(cues)} cues -> {sys.argv[2]}")
