// Dashboard statique MULTI-SUJETS — lit docs/data/subjects.json puis, par sujet,
// docs/data/<id>/{latest,mentions,runs}.json. Onglet = sujet.
'use strict';

const DATA = './data';
const state = { subjects: [], activeId: null, latest: null, mentions: [], runs: [] };

// ---- utils ----
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const s = d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
  return `${s} UTC`;
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// ---- onglets ----
function renderTabs() {
  const nav = $('#tabs');
  nav.innerHTML = '';
  for (const s of state.subjects) {
    const btn = el('button', 'tab' + (s.id === state.activeId ? ' active' : ''), s.label);
    btn.type = 'button';
    btn.dataset.id = s.id;
    if (s.status === 'ALERT') btn.append(el('span', 'tab-dot', ''));
    btn.addEventListener('click', () => selectSubject(s.id));
    nav.append(btn);
  }
}

// ---- rendu sections ----
function renderHero() {
  const l = state.latest;
  const hero = $('#status-hero');
  if (!l) {
    hero.className = 'hero';
    hero.innerHTML = '<div class="hero-loading">Aucune donnée pour ce sujet. La première collecte amorcera la veille.</div>';
    return;
  }
  const status = l.status || 'RAS';
  hero.className = `hero state-${status}`;
  hero.innerHTML = '';
  const grid = el('div', 'hero-grid');

  const badge = el('div', `badge-big ${status}`);
  badge.append(el('span', null, status === 'ALERT' ? '⚠︎' : '✓'));
  badge.append(el('span', null, status === 'ALERT' ? 'ALERTE' : 'RAS'));
  if (l.isBaseline) badge.append(el('span', 'baseline-tag', 'baseline'));
  grid.append(badge);

  const meta = el('div', 'hero-meta');
  const c = l.counts || {};
  const r = c.byRisk || {};
  const metrics = [
    ['Dernier passage', fmtDate(l.generatedAt)],
    ['Prochain passage', fmtDate(l.nextRun)],
    ['Nouvelles ce run', String(c.new ?? 0)],
    ['Mentions suivies', String(c.total ?? 0)],
    ['Risque HIGH / MOD', `${r.HIGH ?? 0} / ${r.MODERATE ?? 0}`],
    [l.alertWindowDays ? `Alertes (${l.alertWindowDays} j glissants)` : 'Alertes depuis',
      l.alertSince ? fmtDate(l.alertSince) : '—'],
  ];
  for (const [k, v] of metrics) {
    const m = el('div', 'metric');
    m.append(el('div', 'k', k), el('div', 'v', v));
    meta.append(m);
  }
  grid.append(meta);
  hero.append(grid);
}

function renderAlert() {
  const banner = $('#alert-banner');
  const l = state.latest;
  const alerting = (l && l.alerting) || [];
  if (!l || l.status !== 'ALERT' || alerting.length === 0) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  banner.innerHTML = '';
  banner.append(el('h2', null, `⚠︎ ${alerting.length} nouvelle(s) mention(s) à risque détectée(s)`));
  const ul = el('ul');
  for (const m of alerting.slice(0, 12)) {
    const li = el('li');
    const a = el('a');
    a.href = m.url; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = m.title;
    li.append(document.createTextNode(`[${m.risk}] `), a,
      el('span', 'run-counts', ` — ${m.platform} · ${String(m.language || '').toUpperCase()} · ${m.keyword}`));
    ul.append(li);
  }
  banner.append(ul);
}

function renderTimeline() {
  const box = $('#runs-timeline');
  box.innerHTML = '';
  if (!state.runs.length) { box.append(el('div', 'empty', 'Aucun passage journalisé pour ce sujet.')); return; }
  for (const run of state.runs.slice(0, 30)) {
    const row = el('div', 'run-row');
    row.append(el('span', 'run-when', fmtDate(run.ranAt)));
    row.append(el('span', `pill ${run.status}`, run.status === 'ALERT' ? 'ALERTE' : 'RAS'));
    const counts = el('span', 'run-counts');
    const br = run.byRisk || {};
    counts.innerHTML = `<b>${run.nNew ?? 0}</b> nouvelle(s) · ${run.nTotal ?? 0} suivies · HIGH ${br.HIGH ?? 0} / MOD ${br.MODERATE ?? 0}` +
      (run.isBaseline ? ' · <i>baseline</i>' : '');
    row.append(counts);
    box.append(row);
  }
}

function platformList() {
  return [...new Set(state.mentions.map((m) => m.platform))].sort();
}

function applyFilters() {
  const lang = $('#f-lang').value;
  const src = $('#f-source').value;
  const plat = $('#f-platform').value;
  const risk = $('#f-risk').value;
  const onlyNew = $('#f-new').checked;
  const text = $('#f-text').value.trim().toLowerCase();

  return state.mentions.filter((m) => {
    if (lang && m.language !== lang) return false;
    if (src && m.sourceType !== src) return false;
    if (plat && m.platform !== plat) return false;
    if (risk && m.risk !== risk) return false;
    if (onlyNew && !m.isNew) return false;
    if (text) {
      const hay = `${m.title} ${m.snippet} ${m.keyword} ${m.author}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

function renderMentions() {
  const list = $('#mentions-list');
  const rows = applyFilters();
  $('#mentions-count').textContent = `${rows.length} affichée(s) sur ${state.mentions.length}`;
  list.innerHTML = '';
  if (!rows.length) { list.append(el('div', 'empty', 'Aucune mention ne correspond aux filtres.')); return; }

  for (const m of rows.slice(0, 200)) {
    const card = el('div', `mention${m.isNew ? ' is-new' : ''}`);
    const top = el('div', 'm-top');
    top.append(el('span', `tag risk-${m.risk}`, m.risk));
    if (m.isNew) top.append(el('span', 'tag new', 'NOUVEAU'));
    top.append(el('span', 'tag lang', m.language || 'und'));
    top.append(el('span', `tag ${m.sourceType === 'owned' ? 'owned' : ''}`.trim(), m.sourceType));
    top.append(el('span', 'tag plat', m.platform));
    if (m.sentiment) top.append(el('span', `tag senti-${m.sentiment}`, m.sentiment));
    card.append(top);

    const a = el('a', 'm-title');
    a.href = m.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m.title;
    card.append(a);
    if (m.snippet) card.append(el('div', 'm-snippet', m.snippet));

    const foot = el('div', 'm-foot');
    foot.append(el('span', null, `🔎 ${m.keyword}`));
    if (m.author) foot.append(el('span', null, `✍︎ ${m.author}`));
    foot.append(el('span', null, `📅 publié : ${m.publishedAt ? fmtDate(m.publishedAt) : 'date inconnue'}`));
    foot.append(el('span', null, `👁 capté : ${fmtDate(m.firstSeenAt)}`));
    card.append(foot);
    list.append(card);
  }
}

function renderManual() {
  const box = $('#manual-links');
  const items = (state.latest && state.latest.manualWatch) || [];
  box.innerHTML = '';
  if (!items.length) { box.append(el('div', 'empty', 'Liens indisponibles.')); return; }
  for (const it of items) {
    const card = el('div', 'manual-item');
    card.append(el('h3', null, it.label));
    if (it.note) card.append(el('p', 'manual-item-note', it.note));
    const links = el('div', 'links');
    const add = (label, href) => {
      if (!href) return;
      const a = el('a', null, label);
      a.href = href; a.target = '_blank'; a.rel = 'noopener';
      links.append(a);
    };
    add(it.instagramIsAccount ? 'Instagram ↗ (compte)' : 'Instagram', it.instagram);
    add('Facebook', it.facebook);
    add('X', it.x);
    add('Google News', it.googleNews);
    card.append(links);
    box.append(card);
  }
}

function initFilters() {
  const sel = $('#f-platform');
  // reset options (garde "Toutes")
  sel.length = 1;
  for (const p of platformList()) {
    const o = el('option', null, p); o.value = p; sel.append(o);
  }
}

function renderAll() {
  const sub = state.subjects.find((s) => s.id === state.activeId);
  $('#subject-sub').textContent = (sub && (sub.description || sub.label)) || '';
  renderHero();
  renderAlert();
  renderTimeline();
  initFilters();
  renderMentions();
  renderManual();
  $('#foot-generated').textContent = state.latest ? fmtDate(state.latest.generatedAt) : '—';
}

// ---- chargement d'un sujet ----
async function selectSubject(id) {
  state.activeId = id;
  renderTabs();
  // reset filtres à chaque changement d'onglet
  ['#f-lang', '#f-source', '#f-platform', '#f-risk'].forEach((s) => { const e = $(s); if (e) e.value = ''; });
  $('#f-new').checked = false;
  $('#f-text').value = '';

  const [latest, mentions, runs] = await Promise.all([
    loadJson(`${DATA}/${id}/latest.json`, null),
    loadJson(`${DATA}/${id}/mentions.json`, []),
    loadJson(`${DATA}/${id}/runs.json`, []),
  ]);
  state.latest = latest;
  state.mentions = Array.isArray(mentions) ? mentions : [];
  state.runs = Array.isArray(runs) ? runs : [];
  renderAll();
}

function bindFilters() {
  ['#f-lang', '#f-source', '#f-platform', '#f-risk'].forEach((s) => $(s).addEventListener('change', renderMentions));
  $('#f-new').addEventListener('change', renderMentions);
  $('#f-text').addEventListener('input', renderMentions);
}

function initTheme() {
  const btn = $('#theme-toggle');
  const stored = localStorage.getItem('veille-theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('veille-theme', next);
  });
}

async function main() {
  initTheme();
  bindFilters();

  const subjects = await loadJson(`${DATA}/subjects.json`, []);
  state.subjects = Array.isArray(subjects) ? subjects : [];

  // Enrichit chaque onglet avec le statut courant (pour la pastille d'alerte).
  const summary = await loadJson(`${DATA}/summary.json`, null);
  if (summary && Array.isArray(summary.subjects)) {
    const byId = Object.fromEntries(summary.subjects.map((s) => [s.id, s]));
    state.subjects = state.subjects.map((s) => ({ ...s, status: byId[s.id]?.status }));
  }

  if (!state.subjects.length) {
    $('#tabs').innerHTML = '';
    $('#subject-sub').textContent = 'Aucun sujet configuré';
    renderHero();
    return;
  }
  await selectSubject(state.subjects[0].id);
}

main();
