# The Next Season — women's basketball fashion research

A static, GitHub Pages site plus a small research database and two scheduled monitors. Start with `RESEARCH_DESIGN.md` for the questions, methods and the ways the findings could mislead.

## How it is organised

| Layer | Files | Who/what writes it |
|---|---|---|
| Reviewed research | `data/launches.json`, `sources.json`, `findings.json`, `taxonomy.json`, `rubric.json`, `price_baseline.json`, `fever.json`, `watchlist.json`, `changelog.json` | A researcher, after reading the source |
| Unreviewed leads | `data/leads.json` | `scripts/refresh_leads.py` (filtered Google News RSS) |
| Observed page changes | `data/pages.json` | `scripts/watch_pages.py` (price/title changes on 4 listed pages) |

Nothing from the last two layers enters a finding automatically.

## Add a launch
1. Read the source. Add it to `sources.json` with a `verified` note.
2. Add a record to `launches.json` using only terms in `taxonomy.json`. Every record needs facts, gaps and sources. Mark marketing statements `claim`.
3. Reference it from a finding's `evidence` (strength recomputes from `rubric.json`).
4. Add a `changelog.json` entry. Run `python scripts/validate.py`.

## Run and test
```bash
python -m http.server 8000       # open http://localhost:8000
python scripts/validate.py       # integrity + computed strengths
python -m unittest discover -s tests -v
```

## Publish
Push to `main`; set **Settings → Pages → Source → GitHub Actions**; run the workflow once. It validates, refreshes both monitors (about every 6 hours), commits their output and deploys.

## Known limits
- The monitors could not be run against the live internet from the build sandbox. Parsing, triage and change detection are unit-tested on fixtures; the first real workflow run is the live test. Some sites block automated requests; a blocked page is recorded as blocked, never as a change.
- Static hosting cannot do on-demand research. Fresh evidence arrives via scheduled jobs and manual review.
- The price baseline is one retailer, one day, tees only. Refresh it monthly (`watchlist.json`).
