"""Evidence-strength rubric. Mirrored in app.js; tests keep the two honest."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def computed_level(n_actors, n_leagues, rubric):
    r = rubric['rules']
    levels = rubric['levels']
    if n_actors >= r['strong_min_actors'] and n_leagues >= r['strong_min_leagues']:
        return levels[3]
    if n_actors >= r['moderate_min_actors']:
        return levels[2]
    if n_actors >= r['early_signal_min_actors']:
        return levels[1]
    return levels[0]


def finding_strength(finding, launches_by_id, rubric):
    """Return (final_level, computed_level, n_actors, n_leagues)."""
    rows = [launches_by_id[e['launch']] for e in finding['evidence']]
    actors = {r['actor'] for r in rows}
    leagues = {r['league'] for r in rows}
    comp = computed_level(len(actors), len(leagues), rubric)
    final = comp
    cap = finding.get('cap')
    if cap:
        levels = rubric['levels']
        final = levels[min(levels.index(comp), levels.index(cap['level']))]
    return final, comp, len(actors), len(leagues)
