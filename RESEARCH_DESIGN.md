# Research design (written before the build)

This is the answer to the brief's final instruction: *identify the strongest research questions, the data needed, the methods, and where findings could mislead — before designing any page.*

## What I audited first (v4 → v5)

I opened every source cited in v4 and checked it against what v4 said. Result: most direction was right, but several specifics were not supported, key price evidence was missing, and the sample leaned on one team (3 of 10 cases were the Atlanta Dream). The full list is in `data/changelog.json` and is shown on the site under "What changed since the last review". The two most important corrections:

- **adidas × Ryoko Rain** was described as including player-exclusive shoes. The source separates them: Ryoko Rain is an apparel collection; the Sabally/Cunningham shoes belong to a different "Crazy Energy Pack".
- **Nike Caitlin 1** was described as a shoe launch. Nike's release lists 18 apparel pieces, available Oct 1; retail listings give actual prices ($35–$325). v4 had none of that.

## The six questions worth answering (and why these)

| # | Question | Why it's strong | Data needed | Method |
|---|----------|-----------------|-------------|--------|
| 1 | **Where is fashion-led product priced relative to a standard fan tee?** | Prices are public, checkable and comparable; Lauren can place her own assortment against them without sharing data. | Published prices per launch + a dated baseline snapshot of regular-price fan tees | Entry/top price vs baseline band; one chart |
| 2 | **Who is actually doing the design and running the business — incumbents or specialists?** | Changes what a planner can ask partners for. | Partner, structure, channel per launch | Classify by structure; look for repeats across sports |
| 3 | **Which silhouettes recur in independent launches?** | "More fashionable" is empty; "varsity jackets and polos recur" is testable. | Product lists per launch mapped to a fixed taxonomy | Silhouette × launch matrix, count independent repeats |
| 4 | **Which non-apparel categories are being added?** | Different price, giftability, lead time. | Category per launch | Same matrix, accessories family |
| 5 | **Do the "local identity" devices travel across sports?** | Tests whether Atlanta is a one-off. | Story/design devices per launch | Look for the *same device in unrelated projects* (e.g. area codes) |
| 6 | **What changed since last time, and what should be watched?** | Makes the site worth revisiting. | Change log, dated watchlist, machine-observed page changes | Diff on each refresh; explicit triggers |

## Ideas I rejected

- **"Women's sports merchandise is growing."** True and useless to Lauren.
- **Trend scores, Google-Trends / Wikipedia graphs, sentiment.** Not tied to any product decision; easy to make look rigorous.
- **Counting launches per month as a growth curve.** The sample is found by searching recent news, so recent months will always look bigger. The site shows a timeline but says this plainly.
- **Anything resembling Fever sales or demand.** No data; any number would be invented.
- **A 60-product catalog.** 15 well-documented launches, each fully classified.

## Where the findings could mislead (and how the build handles it)

1. **Announcements are marketing.** Every fact is tagged with its source grade; marketing claims ("first ever") are tagged separately and never used as evidence.
2. **Selection bias.** The sample is purposive. Strength ratings count independent actors and leagues, and are capped when the evidence is announcement-only.
3. **Mixed price bases.** A "starting at" price, a listing price and a launch range are different things. Each price carries its basis. The baseline is one retailer, tees only, one date.
4. **Higher top price ≠ premium positioning** (jackets always cost more than tees). The chart emphasises **entry price**.
5. **Timing confounds.** 2026 is the WNBA's 30th season; some partnerships (Catbird, Coach charm) are explicitly anniversary-tied. That alone could explain a cluster.
6. **Survivorship.** Only launches that were announced are visible; flops, quiet SKUs and cancelled projects are not.
7. **Unaudited sales claims.** The Liberty profile contains team-reported figures. They are shown, labelled "reported by the team, unaudited", and are not used to rate any finding.

## Evidence strength (rule-based, not vibes)

Strength is *computed* from the data (`data/rubric.json`) and re-checked by tests:

- **Single case:** 1 independent actor
- **Early signal:** 2
- **Moderate:** 3–4
- **Strong:** 5+ independent actors across 2+ leagues
- A finding can be **capped** below its computed level, with the reason shown on the page.

"Strong" means *well documented as a practice*. It never means proven demand, margin or growth.

## What "fresh" means here

| Layer | Source | Status shown on site |
|-------|--------|----------------------|
| Reviewed research | `launches.json`, `findings.json` | Dated; sources read in full |
| New headline leads | `refresh_leads.py` (triaged Google News RSS) | "Unreviewed lead" |
| Observed page changes | `watch_pages.py` (price/title changes on monitored pages) | "Machine-observed, not yet reviewed" |

Nothing from the two automated layers is promoted into findings without a human review and an entry in `changelog.json`.
