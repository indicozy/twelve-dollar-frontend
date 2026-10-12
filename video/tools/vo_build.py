"""Build the voice-over reading page from VOICEOVER-v3c*.md. Usage: vo_build.py TEMPLATE OUT"""
import json
import re
import sys


def parse(path):
    text = open(path).read()
    pattern = r'^## \d+\. (.+?) \((\d+:\d+)(?:, (\d+) s)?\)\n(.+?)(?=\n## |\Z)'
    return [dict(title=m[1], at=m[2], secs=int(m[3]) if m[3] else None, text=m[4].strip())
            for m in re.finditer(pattern, text, re.M | re.S)]


initial, gemma = parse('VOICEOVER-v3c.md'), parse('VOICEOVER-v3c.gemma.md')
assert len(initial) == len(gemma) == 21, (len(initial), len(gemma))
for a, b in zip(initial, gemma):
    b['secs'] = b['secs'] or a['secs']
page = open(sys.argv[1]).read().replace('__DATA__', json.dumps({"initial": initial, "gemma": gemma}))
open(sys.argv[2], 'w').write(page)
