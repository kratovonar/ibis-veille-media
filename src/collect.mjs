// Orchestrateur de la veille.
// Boucle sources × mots-clés → normalise → classe → déduplique → écrit les 4 fichiers JSON.
// Code de sortie 0 dans tous les cas (un run est TOUJOURS journalisé, même "RAS").
import { appendFile } from 'node:fs/promises';
import { KEYWORDS, HASHTAGS, MANUAL_QUERIES } from './keywords.mjs';
import { collectGoogleNews } from './sources/googleNews.mjs';
import { collectReddit } from './sources/reddit.mjs';
import { collectBluesky } from './sources/bluesky.mjs';
import { collectMastodon } from './sources/mastodon.mjs';
import { classify } from './classify.mjs';
import { makeId } from './util.mjs';
import { loadStore, reconcile, persist, ALERT_THRESHOLD, ALERT_SINCE } from './store.mjs';

// Horodatage figé pour tout le passage (déterministe, injectable pour les tests).
const NOW = process.env.VEILLE_NOW ? new Date(process.env.VEILLE_NOW) : new Date();
const nowIso = NOW.toISOString();

// Prochaine exécution planifiée : cron 08:00 et 16:00 UTC.
function nextScheduledRun(from) {
  const hours = [8, 16];
  for (let day = 0; day <= 1; day++) {
    for (const h of hours) {
      const d = new Date(Date.UTC(
        from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + day, h, 0, 0, 0
      ));
      if (d > from) return d.toISOString();
    }
  }
  return null;
}

// Liens de recherche pour le panneau de veille manuelle (non automatisable gratuitement).
function manualWatchLinks() {
  return MANUAL_QUERIES.map((q) => ({
    query: q,
    instagramTag: `https://www.instagram.com/explore/tags/${encodeURIComponent(q.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())}/`,
    facebook: `https://www.facebook.com/search/top?q=${encodeURIComponent(q)}`,
    x: `https://x.com/search?q=${encodeURIComponent(q)}&f=live`,
    googleNews: `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  }));
}

async function gatherRaw() {
  console.log(`[collect] ${nowIso} — démarrage (${KEYWORDS.length} mots-clés)`);
  const results = await Promise.allSettled([
    collectGoogleNews(KEYWORDS),
    collectReddit(KEYWORDS),
    collectBluesky(KEYWORDS),
    collectMastodon(HASHTAGS),
  ]);
  const names = ['google_news', 'reddit', 'bluesky', 'mastodon'];
  const raw = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[collect]   ${names[i]}: ${r.value.length} éléments`);
      raw.push(...r.value);
    } else {
      console.warn(`[collect]   ${names[i]}: ÉCHEC — ${r.reason}`);
    }
  });
  return raw;
}

// Mention de test synthétique (verification d'alerte) : VEILLE_INJECT_TEST=1
function injectTestMention() {
  return classify({
    source: 'test',
    platform: 'news',
    language: 'pt',
    keyword: 'ibis Lisboa Centro Saldanha',
    title: '[TEST] Protesto: colónia de gatos de Arroios ameaçada de despejo junto ao hotel ibis Saldanha',
    url: `https://example.org/test-alert-${Date.now()}`,
    snippet: 'Ativistas denunciam maus-tratos e envenenamento de gatos perto do ibis Lisboa Centro Saldanha. Petição lançada.',
    author: 'Test Source',
    publishedAt: nowIso,
    id: makeId('news', `https://example.org/test-alert-${Date.now()}`),
  });
}

async function ghOutput(status, nNew) {
  const f = process.env.GITHUB_OUTPUT;
  if (!f) return;
  try {
    await appendFile(f, `status=${status}\nn_new=${nNew}\n`, 'utf8');
  } catch (e) {
    console.warn('[collect] écriture GITHUB_OUTPUT échouée:', e?.message);
  }
}

async function main() {
  const store = await loadStore();

  const raw = await gatherRaw();
  const collected = raw
    .filter((m) => m && m.url && m.title)
    .map((m) => classify({ ...m, id: makeId(m.platform, m.url, m.title) }));

  if (process.env.VEILLE_INJECT_TEST === '1') {
    collected.push(injectTestMention());
    console.log('[collect] mention de TEST injectée');
  }

  // dédoublonnage intra-run par id (une même URL peut sortir sur plusieurs mots-clés)
  const uniq = new Map();
  for (const m of collected) if (!uniq.has(m.id)) uniq.set(m.id, m);
  const collectedUniq = [...uniq.values()];
  console.log(`[collect] ${collectedUniq.length} mentions uniques collectées`);

  const rec = reconcile({
    state: store.state,
    mentions: store.mentions,
    collected: collectedUniq,
    isFirstRun: store.isFirstRun,
    nowIso,
  });

  const nextRun = nextScheduledRun(NOW);
  const run = {
    ranAt: nowIso,
    status: rec.status,
    nNew: rec.nNew,
    nTotal: rec.nTotal,
    byRisk: rec.byRisk,
    isBaseline: store.isFirstRun,
  };
  const latest = {
    generatedAt: nowIso,
    status: rec.status,
    isBaseline: store.isFirstRun,
    alertThreshold: ALERT_THRESHOLD,
    alertSince: ALERT_SINCE,
    nextRun,
    counts: { total: rec.nTotal, new: rec.nNew, byRisk: rec.byRisk },
    newMentions: rec.newMentions,
    alerting: rec.alerting,
    manualWatch: manualWatchLinks(),
    sources: ['google_news', 'reddit', 'bluesky', 'mastodon'],
  };

  await persist({
    known: rec.known,
    allMentions: rec.allMentions,
    runs: store.runs,
    run,
    latest,
  });

  await ghOutput(rec.status, rec.nNew);

  console.log(
    `[collect] terminé — statut=${rec.status} nouvelles=${rec.nNew} total=${rec.nTotal} ` +
      `(HIGH=${rec.byRisk.HIGH} MODERATE=${rec.byRisk.MODERATE} LOW=${rec.byRisk.LOW})` +
      (store.isFirstRun ? ' [BASELINE]' : '')
  );
}

main().catch((err) => {
  // On journalise mais on ne casse pas le workflow : la veille doit rester résiliente.
  console.error('[collect] erreur fatale:', err);
  process.exitCode = 0;
});
