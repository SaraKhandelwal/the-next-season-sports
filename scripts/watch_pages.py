#!/usr/bin/env python3
"""Observe a short list of product/announcement pages and record price or title changes.

Polite by design: one request per page per run, identifies itself, honours robots.txt,
never retries around a block. A blocked or unreachable page is recorded as such and is
NOT treated as a change. Observations are machine-made and shown as unreviewed.
"""
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser

ROOT = pathlib.Path(__file__).resolve().parents[1]
WATCH = ROOT / 'data' / 'watchlist.json'
TARGET = ROOT / 'data' / 'pages.json'
UA = 'TheNextSeasonResearch/2.0 (+research; low-volume page monitor)'
PRICE = re.compile(r'\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?')
HISTORY = 30


def extract(raw_html):
    """Return title, normalized visible-text hash, and the sorted set of $ prices."""
    m = re.search(r'<title[^>]*>(.*?)</title>', raw_html, re.I | re.S)
    title = html.unescape(re.sub(r'\s+', ' ', m.group(1))).strip() if m else ''
    body = re.sub(r'<(script|style|noscript)[^>]*>.*?</\1>', ' ', raw_html, flags=re.I | re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    text = re.sub(r'\s+', ' ', text).strip()
    prices = sorted({p.replace(' ', '') for p in PRICE.findall(text)},
                    key=lambda s: float(s.replace('$', '').replace(',', '')))[:60]
    return {'title': title[:200], 'text_hash': hashlib.sha256(text.encode()).hexdigest()[:16], 'prices': prices}


def diff(old, new):
    """Observed events between two snapshots. Pure function."""
    ev = []
    if not old:
        return ev
    if old.get('title') and new['title'] != old['title']:
        ev.append({'kind': 'title_changed', 'from': old['title'], 'to': new['title']})
    added = sorted(set(new['prices']) - set(old.get('prices', [])))
    removed = sorted(set(old.get('prices', [])) - set(new['prices']))
    if added or removed:
        ev.append({'kind': 'prices_changed', 'added': added, 'removed': removed})
    return ev


def allowed(url):
    parts = urllib.parse.urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(f'{parts.scheme}://{parts.netloc}/robots.txt')
    try:
        rp.read()
    except Exception:
        return True  # robots unreachable: proceed with the single polite request
    return rp.can_fetch(UA, url)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read(3_000_000).decode('utf-8', 'replace')


def run():
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    watch = json.loads(WATCH.read_text(encoding='utf-8'))['monitored_pages']
    try:
        prev = json.loads(TARGET.read_text(encoding='utf-8'))
    except Exception:
        prev = {'pages': {}, 'events': []}
    pages, events = prev.get('pages', {}), prev.get('events', [])
    ok = 0
    for w in watch:
        rec = pages.setdefault(w['id'], {'url': w['url'], 'why': w['why'], 'history': []})
        last_good = next((h for h in reversed(rec['history']) if h['status'] == 'ok'), None)
        if not allowed(w['url']):
            snap = {'at': now, 'status': 'robots_disallowed'}
        else:
            try:
                snap = {'at': now, 'status': 'ok', **extract(fetch(w['url']))}
                ok += 1
            except Exception as exc:
                snap = {'at': now, 'status': f'unreachable ({type(exc).__name__})'}
        if snap['status'] == 'ok':
            for e in diff(last_good, snap):
                events.append({'page': w['id'], 'at': now, 'reviewed': False, **e})
        rec['history'] = (rec['history'] + [snap])[-HISTORY:]
    out = {'checked_at': now, 'status': 'ok' if ok else 'all_unreachable', 'pages': pages, 'events': events[-200:]}
    TARGET.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{ok}/{len(watch)} pages observed; {len(out["events"])} events on record.')
    return 0


if __name__ == '__main__':
    sys.exit(run())
