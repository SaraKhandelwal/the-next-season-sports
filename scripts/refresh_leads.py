#!/usr/bin/env python3
"""Collect and TRIAGE public news leads for human review.

This is not a news feed. Headlines are filtered for relevance, tagged
(update on a tracked brand / new name), merged into a rolling queue that
remembers first_seen, and clearly labelled "unreviewed". Nothing here is
ever inserted into launches.json or findings.json automatically.
"""
import datetime as dt
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data' / 'leads.json'

QUERIES = [
    'WNBA collection collaboration apparel when:14d',
    'WNBA official partner jewelry OR handbag OR fashion when:14d',
    'women basketball merchandise retail partnership team store when:14d',
    'NWSL OR PWHL collection collaboration apparel designer when:14d',
    'Indiana Fever merchandise collection collaboration when:14d',
]
TRACKED = ['catbird', 'athleta', 'off season', 'coach', 'monarch', 'round21', 'dead dirt', 'pacsun',
           'new york or nowhere', 'm.m.lafleur', 'mmlafleur', 'playa society', 'ryoko rain',
           'caitlin 1', 'rebel edition', 'drip shop', 'homegrown']
ENTITIES = ['wnba', 'nwsl', 'pwhl', 'fever', 'dream', 'liberty', 'valkyries', 'sparks', 'aces', 'storm',
            'mercury', 'lynx', 'wings', 'mystics', 'sky', 'sun', 'tempo', 'fire', 'angel city',
            'women\'s basketball', 'women\'s soccer', 'women\'s hockey']
PRODUCT = ['collection', 'capsule', 'collab', 'collaboration', 'partner', 'partnership', 'launch', 'drop',
           'apparel', 'merch', 'jewelry', 'handbag', 'jersey', 'hoodie', 'retail', 'store', 'streetwear',
           'sneaker', 'fashion', 'designer', 'limited-edition', 'limited edition']
NOISE = re.compile(r'\b(recap|score|scores|highlights|odds|prediction|picks|injury|injured|trade|trades|'
                   r'free agent|free agency|mock draft|standings|playoff|playoffs|preview|watch live|how to watch|'
                   r'ticket|tickets|schedule|coach of the year|mvp|suspend|fined|contract extension|signs with)\b', re.I)
MAX_KEEP = 150
EXPIRE_DAYS = 45


def get_items(xml_bytes):
    root = ET.fromstring(xml_bytes)
    out = []
    for item in root.findall('./channel/item'):
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        source = (item.findtext('source') or 'News result').strip()
        raw = item.findtext('pubDate') or ''
        if not title or not link.startswith('https://'):
            continue
        try:
            pub = parsedate_to_datetime(raw).astimezone(dt.timezone.utc).date().isoformat()
        except (TypeError, ValueError, OverflowError):
            pub = None
        title = re.sub(r'\s+-\s+[^-]+$', '', title)
        out.append({'title': title[:240], 'url': link, 'source': source[:100], 'published': pub})
    return out


def triage(row):
    """Return a lead dict with tags, or None if it is noise. Pure function: easy to test."""
    t = row['title'].lower()
    if NOISE.search(t):
        return None
    ent = [e for e in ENTITIES if re.search(r'\b' + re.escape(e) + r'\b', t)]
    prod = [p for p in PRODUCT if p in t]
    tracked = [b for b in TRACKED if b in t]
    if not (ent or tracked) or not (prod or tracked):
        return None
    score = len(ent) + 2 * len(prod) + (3 if tracked else 0)
    kind = 'update on a tracked item' if tracked else 'new name to check'
    fever = 'fever' in t
    return {**row, 'kind': kind, 'tracked': tracked, 'fever': fever, 'score': score + (2 if fever else 0)}


def norm(title):
    return re.sub(r'[^a-z0-9]+', ' ', title.lower()).strip()


def merge(previous, fresh, today):
    """Merge triaged fresh leads into the rolling queue; keep first_seen and status."""
    cur = {norm(x['title']): x for x in previous}
    for x in fresh:
        k = norm(x['title'])
        if k in cur:
            cur[k].update({'last_seen': today, 'score': x['score']})
        else:
            cur[k] = {**x, 'first_seen': today, 'last_seen': today, 'status': 'unreviewed'}
    cutoff = (dt.date.fromisoformat(today) - dt.timedelta(days=EXPIRE_DAYS)).isoformat()
    kept = [x for x in cur.values() if x.get('status') != 'unreviewed' or x['last_seen'] >= cutoff]
    kept.sort(key=lambda x: (x['first_seen'], x['score']), reverse=True)
    return kept[:MAX_KEEP]


def refresh():
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    try:
        prev = json.loads(TARGET.read_text(encoding='utf-8'))
    except Exception:
        prev = {'items': [], 'stats': {}}
    fetched = dropped = 0
    fresh, errors = [], 0
    for q in QUERIES:
        url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode(
            {'q': q, 'hl': 'en-US', 'gl': 'US', 'ceid': 'US:en'})
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TheNextSeasonResearch/2.0 (public RSS reader)'})
            with urllib.request.urlopen(req, timeout=20) as resp:
                rows = get_items(resp.read(1_500_000))
        except Exception as exc:
            errors += 1
            print(f'Feed error for {q!r}: {type(exc).__name__}', file=sys.stderr)
            continue
        for row in rows:
            fetched += 1
            lead = triage(row)
            if lead:
                fresh.append(lead)
            else:
                dropped += 1
    if errors == len(QUERIES):
        print('All feeds failed; keeping previous queue untouched.', file=sys.stderr)
        return 1
    items = merge(prev.get('items', []), fresh, today)
    out = {'fetched_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
           'status': 'partial' if errors else 'ok',
           'stats': {'fetched': fetched, 'kept': len(fresh), 'dropped_noise': dropped},
           'items': items}
    TARGET.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'Fetched {fetched}, kept {len(fresh)} after triage, queue size {len(items)}.')
    return 0


if __name__ == '__main__':
    sys.exit(refresh())
