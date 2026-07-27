// Orchestrateur de la veille — MULTI-SUJETS.
// Pour chaque sujet : boucle sources × mots-clés → normalise → classe (avec le topic
// du sujet) → déduplique → écrit docs/data/<sujet>/*.json. Puis manifeste + résumé.
// Code de sortie 0 dans tous les cas (un run est TOUJOURS journalisé, même "RAS").
import { appendFile } from 'node:fs/promises';
import { SUBJECTS } from './subjects.mjs';
import { collectGoogleNews } from './sources/googleNews.mjs';
import { collectReddit } from './sources/reddit.mjs';
import { collectBluesky } from './sources/bluesky.mjs';
import { collectMastodon } from './sources/mastodon.mjs';
import { classify } from './classify.mjs';
import { makeId } from './util.mjs';
import {
  loadStore, reconcile, persist, writeManifest, writeSummary, ALERT_THRESHOLD,
} from './store.mjs';

// Horodatage figé pour tout le passage (déterministe, injectable pour les tests).
const NOW = process.env.VEILLE_NOW ? new Date(process.env.VEILLE_NOW) : new Date();
const nowIso = NOW.toISOString();

// Prochaine exécution planifiée : cron 08:17 et 16:17 UTC.
function nextScheduledRun(from) {
  const slots = [{ h: 8, m: 17 }, { h: 16, m: 17 }];
  for (let day = 0; day <= 1; day++) {
    for (const s of slots) {
      const d = new Date(Date.UTC(
        from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + day, s.h, s.m, 0, 0
      ));
      if (d > from) return d.toISOString();
    }
  }
  return null;
}

// Construit les liens du panneau de veille manuelle à partir d'une entrée de sujet.
// Une entrée peut fournir un compte direct (instagram/facebook) et/ou une requête.
function buildManualLinks(entry) {
  const q = entry.query || entry.label || '';
  const enc = encodeURIComponent(q);
  const igHandle = entry.instagram
    ? `https://www.instagram.com/${String(entry.instagram).replace(/^@/, '')}/`
    : null;
  const fb = entry.facebook
    ? (/^https?:\/\//.test(entry.facebook)
        ? entry.facebook
        : `https://www.facebook.com/search/top?q=${encodeURIComponent(entry.facebook)}`)
    : (q ? `https://www.facebook.com/search/top?q=${enc}` : null);
  return {
    label: entry.label || q,
    note: entry.note || '',
    instagram: igHandle || (q ? `https://www.instagram.com/explore/search/keyword/?q=${enc}` : null),
    instagramIsAccount: Boolean(igHandle),
    facebook: fb,
    x: q ? `https://x.com/search?q=${enc}&f=live` : null,
    googleNews: q ? `https://news.google.com/search?q=${enc}` : null,
  };
}

async function gatherRaw(subject) {
  console.log(`[collect] · ${subject.id} — ${subject.keywords.length} mots-clés, ${subject.hashtags.length} hashtags`);
  const results = await Promise.allSettled([
    collectGoogleNews(subject.keywords),
    collectReddit(subject.keywords),
    collectBluesky(subject.keywords),
    collectMastodon(subject.hashtags),
  ]);
  const names = ['google_news', 'reddit', 'bluesky', 'mastodon'];
  const raw = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[collect]     ${names[i]}: ${r.value.length}`);
      raw.push(...r.value);
    } else {
      console.warn(`[collect]     ${names[i]}: ÉCHEC — ${r.reason}`);
    }
  });
  return raw;
}

// Mention de test synthétique (vérification d'alerte) : VEILLE_INJECT_TEST=1
function injectTestMention(subject) {
  const isFire = subject.id === 'gironde-incendies';
  const url = `https://example.org/test-${subject.id}-${Date.now()}`;
  const raw = isFire
    ? {
        title: '[TEST] Incendie en Gironde : évacuation du Novotel Mérignac et de l’ibis budget Bordeaux Aéroport',
        snippet: 'Les flammes approchent de l’aéroport ; plusieurs hôtels Accor évacués en urgence.',
        keyword: 'incendie Gironde',
      }
    : {
        title: '[TEST] Protesto: colónia de gatos de Arroios ameaçada de despejo junto ao ibis Saldanha',
        snippet: 'Ativistas denunciam maus-tratos e envenenamento de gatos perto do ibis Lisboa Centro Saldanha.',
        keyword: 'ibis Lisboa Centro Saldanha',
      };
  return classify(
    {
      source: 'test', platform: 'news', language: isFire ? 'fr' : 'pt',
      ...raw, url, author: 'Test Source', publishedAt: nowIso, id: makeId('news', url),
    },
    subject.topic
  );
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

async function runSubject(subject) {
  const store = await loadStore(subject.id);
  const raw = await gatherRaw(subject);

  const collected = raw
    .filter((m) => m && m.url && m.title)
    .map((m) => classify({ ...m, id: makeId(m.platform, m.url, m.title) }, subject.topic));

  if (process.env.VEILLE_INJECT_TEST === '1') {
    collected.push(injectTestMention(subject));
    console.log(`[collect]     mention de TEST injectée (${subject.id})`);
  }

  const uniq = new Map();
  for (const m of collected) if (!uniq.has(m.id)) uniq.set(m.id, m);
  const collectedUniq = [...uniq.values()];

  const rec = reconcile({
    state: store.state,
    mentions: store.mentions,
    collected: collectedUniq,
    isFirstRun: store.isFirstRun,
    nowIso,
  });

  const run = {
    ranAt: nowIso, status: rec.status, nNew: rec.nNew, nTotal: rec.nTotal,
    byRisk: rec.byRisk, isBaseline: store.isFirstRun,
  };
  const latest = {
    subjectId: subject.id,
    subjectLabel: subject.label,
    generatedAt: nowIso,
    status: rec.status,
    isBaseline: store.isFirstRun,
    alertThreshold: ALERT_THRESHOLD,
    alertSince: rec.alertSince,
    alertWindowDays: rec.alertWindowDays,
    nextRun: nextScheduledRun(NOW),
    counts: { total: rec.nTotal, new: rec.nNew, byRisk: rec.byRisk },
    newMentions: rec.newMentions,
    alerting: rec.alerting,
    manualWatch: subject.manualWatch.map(buildManualLinks),
    sources: ['google_news', 'reddit', 'bluesky', 'mastodon'],
  };

  await persist(subject.id, {
    known: rec.known, allMentions: rec.allMentions, runs: store.runs, run, latest,
  });

  console.log(
    `[collect] · ${subject.id} → ${rec.status} | nouvelles=${rec.nNew} total=${rec.nTotal} ` +
      `(H=${rec.byRisk.HIGH} M=${rec.byRisk.MODERATE} L=${rec.byRisk.LOW})` +
      (store.isFirstRun ? ' [BASELINE]' : '')
  );

  return {
    id: subject.id, label: subject.label, status: rec.status,
    nNew: rec.nNew, nTotal: rec.nTotal, byRisk: rec.byRisk,
    alerting: rec.alerting.length,
  };
}

async function main() {
  console.log(`[collect] ${nowIso} — démarrage (${SUBJECTS.length} sujets)`);
  const summary = [];
  for (const subject of SUBJECTS) {
    try {
      summary.push(await runSubject(subject));
    } catch (err) {
      console.error(`[collect] sujet ${subject.id} en échec:`, err);
      summary.push({ id: subject.id, label: subject.label, status: 'RAS', error: String(err) });
    }
  }

  await writeManifest(SUBJECTS);
  await writeSummary(summary, nowIso);

  const anyAlert = summary.some((s) => s.status === 'ALERT');
  const totalNew = summary.reduce((n, s) => n + (s.nNew || 0), 0);
  await ghOutput(anyAlert ? 'ALERT' : 'RAS', totalNew);

  console.log(`[collect] terminé — ${anyAlert ? 'ALERT' : 'RAS'} global, ${totalNew} nouvelle(s) au total`);
}

main().catch((err) => {
  console.error('[collect] erreur fatale:', err);
  process.exitCode = 0;
});
