#!/usr/bin/env python3
"""Integrity checks for the research database. Exit 1 on any problem."""
import datetime as dt
import sys
from urllib.parse import urlparse
from rubric import load, finding_strength


def problems():
    out = []
    L = load('launches.json')['launches']
    S = load('sources.json')['sources']
    F = load('findings.json')
    T = load('taxonomy.json')
    R = load('rubric.json')
    W = load('watchlist.json')
    ids = [l['id'] for l in L]
    if len(ids) != len(set(ids)):
        out.append('duplicate launch ids')
    by = {l['id']: l for l in L}
    for sid, s in S.items():
        u = urlparse(s['url'])
        if u.scheme != 'https' or not u.netloc:
            out.append(f'source {sid}: bad url')
        if s['type'] not in ('primary', 'reported', 'listing'):
            out.append(f'source {sid}: bad type')
        if not s.get('verified'):
            out.append(f'source {sid}: missing verification note')
        if s.get('date'):
            try:
                dt.date.fromisoformat(s['date'])
            except ValueError:
                out.append(f'source {sid}: bad date')
    for l in L:
        i = l['id']
        if not l['source_ids']:
            out.append(f'{i}: no sources')
        if not l['gaps']:
            out.append(f'{i}: must state what is missing')
        for sid in l['source_ids']:
            if sid not in S:
                out.append(f'{i}: unknown source {sid}')
        for f in l['facts']:
            if f['s'] not in S:
                out.append(f'{i}: fact cites unknown source {f["s"]}')
            if f['k'] not in ('fact', 'price', 'claim'):
                out.append(f'{i}: bad fact kind')
        for s in l['silhouettes']:
            if s not in T['silhouettes']:
                out.append(f'{i}: silhouette {s} not in taxonomy')
        for s in l['story']:
            if s not in T['story_devices']:
                out.append(f'{i}: story {s} not in taxonomy')
        if l['structure'] not in T['structures']:
            out.append(f'{i}: structure not in taxonomy')
        p = l.get('price')
        if p:
            if p['source'] not in S:
                out.append(f'{i}: price source unknown')
            if p['high'] is not None and p['high'] < p['low']:
                out.append(f'{i}: price high < low')
            if not any(f['k'] == 'price' and f['s'] == p['source'] for f in l['facts']):
                out.append(f'{i}: price has no matching price fact')
        if l['announced_precision'] == 'day':
            try:
                dt.date.fromisoformat(l['announced'])
            except Exception:
                out.append(f'{i}: bad announced date')
        if l['fever']['level'] not in ('direct', 'indirect', 'none'):
            out.append(f'{i}: bad fever level')
    for f in F['findings']:
        if not f['evidence']:
            out.append(f'finding {f["id"]}: no evidence')
        for e in f['evidence']:
            if e['launch'] not in by:
                out.append(f'finding {f["id"]}: unknown launch {e["launch"]}')
        if not f['alternatives'] or not f['missing'] or not f['change_mind']:
            out.append(f'finding {f["id"]}: must include alternatives, missing evidence, what would change our mind')
        for w in f['watch']:
            if w not in {x['id'] for x in W['items']}:
                out.append(f'finding {f["id"]}: unknown watch item {w}')
        if f.get('cap') and f['cap']['level'] not in R['levels']:
            out.append(f'finding {f["id"]}: bad cap level')
    return out


def main():
    p = problems()
    for x in p:
        print('PROBLEM:', x)
    L = {l['id']: l for l in load('launches.json')['launches']}
    R = load('rubric.json')
    for f in load('findings.json')['findings']:
        final, comp, na, nl = finding_strength(f, L, R)
        print(f'{f["id"]:12s} actors={na} leagues={nl} computed={comp} final={final}')
    return 1 if p else 0


if __name__ == '__main__':
    sys.exit(main())
