"""Find where each slide starts in an edited take, from the phrase that opens its section.
Usage: place_slides.py WORDS.json    (WORDS.json from transcribe_words.py)
Prints the `slides` list for the Voiced composition in Root.tsx."""
import difflib
import json
import re
import sys

# The words that open each slide's section, in order (from take-195334, the raw take the edit was cut from).
ANCHORS = [
    ("Hook", "how much does your frontend framework actually matter"),
    ("Scope", "to be clear i'm only testing the server"),
    ("TheSite", "the app is a tiny twitter clone"),
    ("Setup", "the setup is two small servers"),
    ("OneUser", "so what is a user"),
    ("PassFail", "the rules of the test"),
    ("SearchPath", "so how do i find this limit"),
    ("ResultsTable", "and here are results on top"),
    ("BigQuestion", "so question is why is next.js so slow"),
    ("NotRam", "my first guess was memory"),
    ("CpuPerRequest", "so i measured how much cpu each request actually burns"),
    ("ReactFamily", "maybe it's react's fault"),
    ("NextVsRemix", "remix has much simpler rendering pipelines than next.js"),
    ("AbstractionLadder", "and if you zoom out you can see a pattern"),
    ("Caching", "okay but we can cache it right"),
    ("CacheModes", "so i made my smart cache"),
    ("CacheCosts", "so why does the cache stop at 3600"),
    ("NoFramework", "but what if we don't use any framework"),
    ("OtherLangs", "but if we look at the outside of javascript"),
    ("FixFirst", "but some of the results look too wrong for me so i profiled them"),
    ("NextHub", "if you're using next.js today you've optimized your code"),
    ("TakeawaysV2", "the more the abstraction the more cpu time for rendering"),
]
LEAD = 0.3  # start the slide a little before the first word

norm = lambda s: re.sub(r"[^a-z0-9' ]", "", s.lower().replace(".", "")).split()
words = [w for seg in json.load(open(sys.argv[1])) for w in seg["words"]]
toks = [" ".join(norm(w["w"])) for w in words]

pos, out = 0, []
for sid, phrase in ANCHORS:
    p = norm(phrase)
    n = len(p)
    best = max(range(pos, max(pos + 1, len(toks) - n + 1)),
               key=lambda i: (difflib.SequenceMatcher(None, p, toks[i:i + n]).ratio(), -i))
    score = difflib.SequenceMatcher(None, p, toks[best:best + n]).ratio()
    t = round(max(0, words[best]["s"] - LEAD), 1) if sid != "Hook" else 0
    out.append((sid, t, score, " ".join(toks[best:best + n])))
    pos = best + 1

for sid, t, score, heard in out:
    flag = "" if score >= 0.6 else "   <-- weak match, check"
    print(f"{sid:18} {int(t // 60)}:{t % 60:04.1f}  {score:.2f}  {heard}{flag}", file=sys.stderr)
print(",\n".join(f'          {{ id: "{sid}", start: {t} }}' for sid, t, _, _ in out))
