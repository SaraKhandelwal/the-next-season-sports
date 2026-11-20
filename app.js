(() => {
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const D = {};          // all loaded data
let lastFocus = null;
let filter = 'all';

/* ---------- formatting ---------- */
function fmtDate(iso, precision = 'day') {
  if (!iso || precision === 'undated') return 'Undated';
  const [y, m, d] = iso.split('-').map(Number);
  if (precision === 'month' || !d) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
function priceText(p) {
  if (!p) return null;
  if (p.high === null) return `from ${money(p.low)}`;
  if (p.low === p.high) return money(p.low);
  return `${money(p.low)}–${money(p.high)}`;
}
const gradeOf = s => (s.type === 'reported' ? 'B' : 'A');
const gradeClass = g => ({A: 'g-a', B: 'g-b', C: 'g-c'}[g]);
const launch = id => D.launches.find(l => l.id === id);
const lbl = k => D.tax.silhouettes[k]?.label || k;

/* ---------- strength (mirrors scripts/rubric.py) ---------- */
function strength(f) {
  const rows = f.evidence.map(e => launch(e.launch));
  const actors = new Set(rows.map(r => r.actor)).size;
  const leagues = new Set(rows.map(r => r.league)).size;
  const r = D.rubric.rules, L = D.rubric.levels;
  let comp = L[0];
  if (actors >= r.strong_min_actors && leagues >= r.strong_min_leagues) comp = L[3];
  else if (actors >= r.moderate_min_actors) comp = L[2];
  else if (actors >= r.early_signal_min_actors) comp = L[1];
  let final = comp;
  if (f.cap) final = L[Math.min(L.indexOf(comp), L.indexOf(f.cap.level))];
  return {final, comp, actors, leagues, capped: final !== comp};
}
const pillClass = lvl => lvl.split(' ')[0];

function srcChip(id) {
  const s = D.sources[id];
  if (!s) return '';
  const g = gradeOf(s);
  return `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)} — ${esc(s.verified)}"><span class="grade ${gradeClass(g)}">${g}</span>${esc(s.publisher)} ↗</a>`;
}

/* ---------- hero ---------- */
function renderHero() {
  $('headline').textContent = D.findings.headline;
  const nSrc = Object.keys(D.sources).length;
  const nLaunch = D.launches.length;
  $('hero-sub').textContent = `Built from ${nLaunch} documented launches in women's basketball and adjacent women's sports. Every claim links to a source that was read in full, and every pattern states what would change our mind.`;
  $('hero-stats').innerHTML = [
    `<b>${nLaunch}</b> launches classified`,
    `<b>${nSrc}</b> sources read`,
    `<b>${D.findings.findings.length}</b> findings, each rated by rule`,
    `Reviewed <b>${fmtDate(D.launchFile.as_of)}</b>`
  ].map(x => `<li>${x}</li>`).join('');
  $('foot-asof').textContent = `Research reviewed ${fmtDate(D.launchFile.as_of)}. Automated layers refresh on their own schedule and are labelled where shown.`;
}

/* ---------- findings ---------- */
function renderCards() {
  $('finding-cards').innerHTML = D.findings.findings.map(f => {
    const s = strength(f);
    return `<button class="card" type="button" data-finding="${esc(f.id)}">
      <div class="card-top"><span class="num">0${f.n}</span><span class="pill ${pillClass(s.final)}" title="${esc(D.rubric.meaning[s.final])}">${esc(s.final)}</span></div>
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.plain)}</p>
      <div class="card-foot"><span>${s.actors} independent ${s.actors === 1 ? 'example' : 'examples'} · ${s.leagues} ${s.leagues === 1 ? 'league' : 'leagues'}</span><span class="more">See the evidence →</span></div>
    </button>`;
  }).join('');
}

function findingDrawer(id) {
  const f = D.findings.findings.find(x => x.id === id);
  if (!f) return;
  const s = strength(f);
  const watch = f.watch.map(w => D.watch.items.find(i => i.id === w)).filter(Boolean);
  const ev = f.evidence.map(e => {
    const l = launch(e.launch);
    const chips = l.source_ids.map(srcChip).join(' ');
    return `<div class="ev-item"><b>${esc(l.short)} <span class="sm">· ${esc(fmtDate(l.announced, l.announced_precision))}</span></b><span>${esc(e.shows)}</span><div class="row">${chips}<button class="chip" type="button" data-launch="${esc(l.id)}">Full classification</button></div></div>`;
  }).join('');
  openDrawer(`
    <p class="kicker">Finding ${f.n}</p>
    <h2 id="drawer-title">${esc(f.title)}</h2>
    <p><span class="pill ${pillClass(s.final)}">${esc(s.final)}</span> <span class="sm">${s.actors} independent examples across ${s.leagues} ${s.leagues === 1 ? 'league' : 'leagues'}</span></p>
    <p>${esc(D.rubric.meaning[s.final])}</p>
    ${s.capped ? `<div class="callout"><b>Capped from ${esc(s.comp)}.</b> ${esc(f.cap.reason)}</div>` : ''}
    <span class="dl">In plain terms</span><p>${esc(f.plain)}</p>
    <span class="dl">The launches behind it</span>${ev}
    <span class="dl">Is this broader, or isolated?</span><p>${esc(f.broader)}</p>
    <span class="dl">Other explanations to rule out</span><ul>${f.alternatives.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    <span class="dl">Why it might matter for planning</span><p>${esc(f.matters)}</p>
    <span class="dl">What would change our mind</span><p>${esc(f.change_mind)}</p>
    <span class="dl">Evidence still missing</span><ul>${f.missing.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    ${watch.length ? `<span class="dl">What to watch</span><ul>${watch.map(w => `<li><b>${esc(w.title)}</b> — ${esc(w.trigger)}</li>`).join('')}</ul>` : ''}
  `);
  history.replaceState(null, '', `#finding-${id}`);
}

/* ---------- price chart ---------- */
function priced() {
  return D.launches.filter(l => l.price).sort((a, b) => a.price.low - b.price.low);
}
function renderPrice() {
  const B = D.baseline, rows = priced();
  $('price-lede').textContent = `A regular-price women's or unisex fan tee at the WNBA Store runs ${money(B.regular_low)}–${money(B.regular_high)} (read ${fmtDate(B.snapshot_date)}). Each line below is one launch's published price range. The shaded band is that tee price.`;
  const W = 800, left = 200, right = 120, top = 40, rh = 40, H = top + rows.length * rh + 36;
  const pw = W - left - right, X = v => left + v / 400 * pw;
  let g = '';
  [0, 100, 200, 300, 400].forEach(v => {
    g += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 10}" y2="${H - 30}" stroke="#e4dccb" stroke-width="1"/><text x="${X(v)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#6b6f7b">${v ? '$' + v : '$0'}</text>`;
  });
  g += `<rect x="${X(B.regular_low)}" y="${top - 10}" width="${X(B.regular_high) - X(B.regular_low)}" height="${H - top - 20}" fill="#1f6f6b" opacity=".18"/>`;
  g += `<text x="${X(B.regular_high) + 6}" y="${top - 16}" font-size="12" fill="#1f6f6b" font-weight="600">Fan tee ${money(B.regular_low)}–${money(B.regular_high)}</text>`;
  rows.forEach((l, i) => {
    const y = top + i * rh + 14, p = l.price, x1 = X(p.low);
    g += `<text x="${left - 14}" y="${y + 4}" text-anchor="end" font-size="13" fill="#17181d">${esc(l.short)}</text>`;
    if (p.high === null) {
      g += `<line x1="${x1}" x2="${X(400)}" y1="${y}" y2="${y}" stroke="#c4472b" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/><path d="M${X(400) - 2} ${y - 5} L${X(400) + 8} ${y} L${X(400) - 2} ${y + 5}" fill="none" stroke="#c4472b" stroke-width="2"/>`;
      g += `<circle cx="${x1}" cy="${y}" r="6" fill="#c4472b"/><text x="${X(400) + 14}" y="${y + 4}" font-size="12.5" fill="#464a55">from ${money(p.low)}</text>`;
    } else if (p.low === p.high) {
      g += `<circle cx="${x1}" cy="${y}" r="6" fill="#c4472b"/><text x="${x1 + 12}" y="${y + 4}" font-size="12.5" fill="#464a55">${money(p.low)}</text>`;
    } else {
      const x2 = X(p.high);
      g += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="#c4472b" stroke-width="4" stroke-linecap="round"/><circle cx="${x1}" cy="${y}" r="6" fill="#c4472b"/><circle cx="${x2}" cy="${y}" r="6" fill="#fffdf9" stroke="#c4472b" stroke-width="3"/><text x="${x2 + 12}" y="${y + 4}" font-size="12.5" fill="#464a55">${money(p.low)}–${money(p.high)}</text>`;
    }
  });
  const desc = `Published price ranges for ${rows.length} launches against a fan-tee band of ${money(B.regular_low)} to ${money(B.regular_high)}.`;
  $('price-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">${g}</svg>`;
  const f = D.findings.findings.find(x => x.id === 'price');
  $('price-note').innerHTML = `<p><b>How to read it.</b> Filled dot = lowest published price (the entry point). Open dot = highest. A dashed line means only a starting price was published. Jackets and jewelry cost more than tees anywhere, so look at the <b>entry</b> end of each line, not the top.</p>
    <p><b>What this cannot tell you.</b></p><ul>${B.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p style="margin-top:10px">${esc(f.broader)}</p>`;
  $('price-table').innerHTML = `<table><thead><tr><th>Launch</th><th>Entry</th><th>Top</th><th>Entry vs tee-band top</th><th>Price basis</th><th>Source</th></tr></thead><tbody>${rows.map(l => {
    const p = l.price;
    return `<tr><td>${esc(l.short)}</td><td>${money(p.low)}</td><td>${p.high === null ? 'not published' : money(p.high)}</td><td>${(p.low / B.regular_high).toFixed(1)}×</td><td>${esc(p.basis)}</td><td>${srcChip(p.source)}</td></tr>`;
  }).join('')}</tbody></table>`;
}

/* ---------- evidence board ---------- */
const FILTERS = [
  ['all', 'All launches', () => true],
  ['wnba', 'WNBA', l => l.league === 'WNBA'],
  ['other', 'NWSL and other', l => l.league !== 'WNBA'],
  ['price', 'Prices published', l => !!l.price],
  ['fever', 'Fever-relevant', l => l.fever.level !== 'none']
];
function renderFilters() {
  $('filters').innerHTML = FILTERS.map(([k, t]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === filter}">${esc(t)}</button>`).join('');
}
function renderBoard() {
  const fn = FILTERS.find(f => f[0] === filter)[2];
  const rows = D.launches.filter(fn).sort((a, b) => (b.announced || '0').localeCompare(a.announced || '0'));
  $('board').querySelector('tbody').innerHTML = rows.map(l => {
    const grades = [...new Set(l.source_ids.map(id => gradeOf(D.sources[id])))].sort();
    const price = priceText(l.price);
    return `<tr tabindex="0" data-launch="${esc(l.id)}" role="button" aria-label="Open details for ${esc(l.short)}">
      <td class="nowrap">${esc(fmtDate(l.announced, l.announced_precision))}</td>
      <td class="who"><b>${esc(l.short)}</b><small>${esc(l.league)}${l.team && l.team !== 'League-wide' ? ' · ' + esc(l.team) : ''}</small>${l.fever.level === 'direct' ? '<br><span class="tag fever">Fever</span>' : ''}</td>
      <td><span class="tag">${esc(D.tax.structures[l.structure])}</span><br><span class="sm">${esc(l.categories.join(', '))}</span></td>
      <td class="nowrap">${price ? `<b>${esc(price)}</b><br><span class="sm">${esc(l.price.basis)}</span>` : '<span class="sm">Not published</span>'}</td>
      <td class="sm">${esc(l.channels.slice(0, 2).join(' · '))}</td>
      <td class="nowrap">${grades.map(g => `<span class="grade ${gradeClass(g)}" title="Source grade ${g}">${g}</span>`).join('')}</td>
    </tr>`;
  }).join('');
  $('board-count').textContent = `${rows.length} of ${D.launches.length} launches shown. Grades: A issued by the seller or retailer, B independent publication.`;
}

function launchDrawer(id) {
  const l = launch(id);
  if (!l) return;
  const price = priceText(l.price);
  const row = (k, v) => v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '';
  const factKind = {fact: 'Stated', price: 'Price', claim: 'Claim'};
  openDrawer(`
    <p class="kicker">${esc(l.league)} · ${esc(fmtDate(l.announced, l.announced_precision))}</p>
    <h2 id="drawer-title">${esc(l.name)}</h2>
    <p>${esc(l.collab)}</p>
    <span class="dl">What the sources say</span>
    <ul class="facts">${l.facts.map(f => `<li class="fact"><span class="fk ${f.k}">${factKind[f.k]}</span>${esc(f.t)} <span class="sm">${srcChip(f.s)}</span></li>`).join('')}</ul>
    ${l.facts.some(f => f.k === 'claim') ? '<div class="callout">Items tagged <b>Claim</b> are marketing or unaudited statements. They are shown for completeness and are not used as evidence.</div>' : ''}
    <span class="dl">How it is classified</span>
    <table class="attrs"><tbody>
      ${row('Structure', esc(D.tax.structures[l.structure]))}
      ${row('Categories', esc(l.categories.join(', ')))}
      ${row('Silhouettes documented', l.silhouettes.length ? esc(l.silhouettes.map(lbl).join(', ')) : 'None documented in sources')}
      ${row('Materials stated', l.materials.length ? esc(l.materials.join('; ')) : 'Not disclosed')}
      ${row('Published price', price ? `${esc(price)} <span class="sm">(${esc(l.price.basis)}). ${esc(l.price.note)}</span>` : 'Not published')}
      ${row('Audience / use', esc(l.audience))}
      ${row('Story and design devices', l.story.length ? esc(l.story.map(s => D.tax.story_devices[s]).join('; ')) : 'None documented')}
      ${row('Where sold', esc(l.channels.join('; ')))}
      ${row('Release approach', esc(l.release_model))}
      ${row('Announced', esc(fmtDate(l.announced, l.announced_precision)))}
      ${row('Availability', esc(l.available))}
      ${row('Fever relevance', `${esc({direct: 'Direct', indirect: 'Indirect', none: 'None'}[l.fever.level])}. ${esc(l.fever.note)}`)}
    </tbody></table>
    <span class="dl">What the sources do not tell us</span><ul>${l.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
    <span class="dl">Original sources</span><div class="row" style="display:flex;gap:8px;flex-wrap:wrap">${l.source_ids.map(srcChip).join('')}</div>
    <p class="fine" style="margin-top:12px">${l.source_ids.map(i => esc(D.sources[i].publisher + ': ' + D.sources[i].verified)).join(' · ')}</p>
  `);
  history.replaceState(null, '', `#launch-${id}`);
}

/* ---------- silhouette matrix ---------- */
function renderMatrix() {
  const cols = D.launches.filter(l => !l.profile).sort((a, b) => (a.announced || '9').localeCompare(b.announced || '9'));
  const keys = Object.keys(D.tax.silhouettes).filter(k => cols.some(l => l.silhouettes.includes(k)));
  const fams = [...new Set(keys.map(k => D.tax.silhouettes[k].family))];
  let h = `<table class="matrix"><thead><tr><th class="rowh">Shape</th>${cols.map(l => `<th><span>${esc(l.short)}</span></th>`).join('')}<th class="rowh" style="min-width:70px;text-align:center">Launches</th></tr></thead><tbody>`;
  fams.forEach(fam => {
    h += `<tr class="fam"><td colspan="${cols.length + 2}">${esc(fam)}</td></tr>`;
    keys.filter(k => D.tax.silhouettes[k].family === fam).forEach(k => {
      const n = cols.filter(l => l.silhouettes.includes(k)).length;
      h += `<tr><td class="rowh">${esc(lbl(k))}</td>${cols.map(l => `<td>${l.silhouettes.includes(k) ? `<span class="dot" title="${esc(l.short)}: ${esc(lbl(k))}"></span><span class="sr" hidden>yes</span>` : ''}</td>`).join('')}<td class="rc ${n >= 2 ? 'multi' : ''}">${n}</td></tr>`;
    });
  });
  $('matrix').innerHTML = h + '</tbody></table>';
}

/* ---------- timeline ---------- */
function quarter(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `Q${Math.ceil(m / 3)} ${y}`;
}
function renderTimeline() {
  const dated = D.launches.filter(l => l.announced);
  const qs = [];
  for (let y = 2025; y <= 2026; y++) for (let q = 1; q <= 4; q++) if (y > 2025 || q >= 2) qs.push(`Q${q} ${y}`);
  const by = {};
  dated.forEach(l => (by[quarter(l.announced)] ||= []).push(l));
  $('timeline-lede').textContent = 'Read this as a record of when launches were announced, not as growth. The set was found by searching recent coverage, so recent quarters will always look fuller. It becomes a real trend line only if future additions are collected the same way each month.';
  $('timeline').innerHTML = qs.filter(q => q !== 'Q4 2026' || by[q]).map(q => `<div class="tq"><h4>${q}</h4>${(by[q] || []).sort((a, b) => a.announced.localeCompare(b.announced)).map(l => `<button type="button" data-launch="${esc(l.id)}">${esc(l.short)}</button>`).join('') || '<span class="none">none logged</span>'}</div>`).join('');
}

/* ---------- Fever lens ---------- */
function renderFever() {
  const F = D.fever;
  $('fever-lede').textContent = F.intro;
  $('fever-signals').innerHTML = F.signals.map(s => `<li>${esc(s.t)} ${srcChip(s.s)}${s.optional ? ' <span class="sm">(public interview; remove if inappropriate)</span>' : ''}</li>`).join('');
  $('fever-gap').innerHTML = `<b>Not found.</b> ${esc(F.not_found)}`;
  $('fever-questions').innerHTML = F.questions.map(q => `<li>${esc(q)}</li>`).join('');
}

/* ---------- watch ---------- */
function renderWatch() {
  const titleOf = id => D.findings.findings.find(f => f.id === id)?.title;
  $('watchlist').innerHTML = D.watch.items.map(w => `<article class="watch">
    <span class="st ${esc(w.status)}">${esc({waiting: 'Waiting for it', monitored: 'Monitored automatically', due: 'Due'}[w.status] || w.status)} · ${esc(w.when)}</span>
    <h4>${esc(w.title)}</h4><p>${esc(w.what)}</p>
    <div class="trig"><b>Trigger:</b> ${esc(w.trigger)}<br><b>Tests:</b> ${w.tests.map(t => esc(titleOf(t) || t).split(':')[0]).join('; ')}</div>
  </article>`).join('');
}
function ago(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
function renderAuto() {
  const P = D.pages, Ls = D.leads;
  $('pages-stamp').textContent = P && P.checked_at ? `Last checked ${ago(P.checked_at)}` : 'Not run yet';
  if (!P || !P.checked_at) {
    $('pages-body').innerHTML = '<div class="empty">No page checks have run yet. Once the scheduled GitHub workflow runs, price or title changes on the four monitored pages will appear here, marked as machine-observed and unreviewed.</div>';
  } else {
    const pages = Object.entries(P.pages);
    const evs = (P.events || []).slice(-5).reverse();
    $('pages-body').innerHTML = `${evs.length ? evs.map(e => `<div class="ev"><b>${esc(e.kind === 'prices_changed' ? 'Prices changed' : 'Title changed')}</b> on ${esc(e.page)} <span class="sm">· ${esc(ago(e.at))} · machine-observed, unreviewed</span><br>${e.kind === 'prices_changed' ? `<span class="sm">Added ${esc((e.added || []).join(', ') || 'none')}; removed ${esc((e.removed || []).join(', ') || 'none')}</span>` : `<span class="sm">${esc(e.from)} → ${esc(e.to)}</span>`}</div>`).join('') : '<div class="empty">No changes observed since monitoring began.</div>'}
      <p class="fine" style="margin-top:10px">${pages.map(([id, p]) => { const h = p.history[p.history.length - 1]; return `${esc(id)}: ${esc(h ? h.status : 'no data')}`; }).join(' · ')}. A blocked page is not a change.</p>`;
  }
  $('leads-stamp').textContent = Ls && Ls.fetched_at ? `Last run ${ago(Ls.fetched_at)}` : 'Not run yet';
  if (!Ls || !Ls.fetched_at) {
    $('leads-body').innerHTML = '<div class="empty">No lead collection has run yet. When it does, this shows only headlines that pass a relevance filter (brand/team plus a product or partnership term, with game news removed). They are leads to read, not findings.</div>';
  } else {
    const st = Ls.stats || {};
    const items = (Ls.items || []).filter(i => i.status === 'unreviewed').slice(0, 6);
    $('leads-body').innerHTML = `<p class="fine" style="margin:0 0 8px">Last run: ${st.fetched ?? 0} headlines fetched, ${st.kept ?? 0} passed filtering, ${st.dropped_noise ?? 0} dropped as irrelevant.</p>` +
      (items.length ? items.map(i => `<div class="lead"><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.title)} ↗</a><small>${esc(i.source)} · first seen ${esc(i.first_seen)} · ${esc(i.kind)}${i.fever ? ' · mentions Fever' : ''} · <b>unreviewed</b></small></div>`).join('') : '<div class="empty">Nothing new passed the filter in the latest run.</div>');
  }
}

/* ---------- trust ---------- */
function renderTrust() {
  $('rubric').innerHTML = D.rubric.levels.slice().reverse().map(l => `<dt><span class="pill ${pillClass(l)}" style="margin-right:8px">${esc(l)}</span></dt><dd class="rub">${esc(D.rubric.meaning[l])}</dd>`).join('') + '<dd class="rub" style="margin-top:12px">Ratings are computed from the data and can be capped, with the reason shown.</dd>';
  $('notfindings').innerHTML = D.findings.not_a_finding.map(n => `<li><b>${esc(n.claim)}</b> ${esc(n.why)}</li>`).join('');
  const kindLabel = {correction: 'Correction', 'source-replaced': 'Sources replaced', added: 'Added', 'date-fix': 'Date fixed', baseline: 'Baseline'};
  $('changelog').innerHTML = D.changelog.entries.map(e => `<li><span class="k">${esc(kindLabel[e.kind] || e.kind)} · ${esc(fmtDate(e.date))}</span><b>${esc(e.title)}</b><p>${esc(e.detail)}</p></li>`).join('');
  $('footer-note').textContent = 'Full research design, including ideas rejected and ways the findings could mislead, is in RESEARCH_DESIGN.md in the repository.';
}

/* ---------- drawer ---------- */
function openDrawer(html) {
  lastFocus = document.activeElement;
  $('drawer-body').innerHTML = html;
  $('drawer-shell').hidden = false;
  $('drawer').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  $('drawer-close').focus();
}
function closeDrawer() {
  $('drawer-shell').hidden = true;
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const f = e.target.closest('[data-finding]'); if (f) return findingDrawer(f.dataset.finding);
  const l = e.target.closest('[data-launch]'); if (l) return launchDrawer(l.dataset.launch);
  const c = e.target.closest('[data-filter]'); if (c) { filter = c.dataset.filter; renderFilters(); renderBoard(); }
});
document.addEventListener('keydown', e => {
  const shell = $('drawer-shell');
  if (e.key === 'Escape' && !shell.hidden) return closeDrawer();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-launch]')) { e.preventDefault(); return launchDrawer(e.target.dataset.launch); }
  if (e.key === 'Tab' && !shell.hidden) {
    const nodes = [...$('drawer').querySelectorAll('a[href],button:not([disabled])')];
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('drawer-close').addEventListener('click', closeDrawer);
$('drawer-shade').addEventListener('click', closeDrawer);

/* ---------- boot ---------- */
async function getJson(name, optional = false) {
  try {
    const r = await fetch(`data/${name}`, {cache: 'no-cache'});
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return await r.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}
async function init() {
  try {
    const [launchFile, sources, findings, tax, rubric, baseline, fever, watch, changelog, leads, pages] = await Promise.all([
      getJson('launches.json'), getJson('sources.json'), getJson('findings.json'), getJson('taxonomy.json'), getJson('rubric.json'),
      getJson('price_baseline.json'), getJson('fever.json'), getJson('watchlist.json'), getJson('changelog.json'),
      getJson('leads.json', true), getJson('pages.json', true)
    ]);
    Object.assign(D, {launchFile, launches: launchFile.launches, sources: sources.sources, findings, tax, rubric, baseline, fever, watch, changelog, leads, pages});
    renderHero(); renderCards(); renderPrice(); renderFilters(); renderBoard(); renderMatrix(); renderTimeline();
    renderFever(); renderWatch(); renderAuto(); renderTrust();
    const m = location.hash.match(/^#(finding|launch)-(.+)$/);
    if (m) (m[1] === 'finding' ? findingDrawer : launchDrawer)(m[2]);
  } catch (err) {
    $('headline').textContent = 'The research data could not be loaded.';
    $('hero-sub').textContent = 'Open this site through GitHub Pages or a local web server (python -m http.server), not directly from a file. ' + err.message;
  }
}
init();
})();
