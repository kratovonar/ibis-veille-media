// Source : recherche Reddit publique (endpoint .json, gratuit, sans OAuth).
// BEST-EFFORT : Reddit bloque fréquemment les IP de datacenter (dont les runners
// GitHub Actions) et renvoie alors du HTML ou un 403. Le code dégrade proprement
// (fetchJson renvoie null → 0 mention, pas d'erreur). Un User-Agent au format
// recommandé par Reddit améliore le taux de succès depuis les IP autorisées.
import { fetchJson, stripHtml, truncate, sleep } from '../util.mjs';

const REDDIT_UA = 'nodejs:ibis-veille-media:1.0 (by /u/veille-bot)';

function buildUrl({ term, phrase }) {
  const q = phrase ? `"${term}"` : term;
  const params = new URLSearchParams({ q, sort: 'new', limit: '25', t: 'year' });
  return `https://www.reddit.com/search.json?${params.toString()}`;
}

export async function collectReddit(keywords) {
  const out = [];
  for (const kw of keywords) {
    const data = await fetchJson(buildUrl(kw), { headers: { 'User-Agent': REDDIT_UA } });
    await sleep(1200); // Reddit non authentifié : rester très prudent sur la cadence
    const children = data?.data?.children;
    if (!Array.isArray(children)) continue;

    for (const c of children) {
      const p = c?.data;
      if (!p) continue;
      const url = `https://www.reddit.com${p.permalink}`;
      const body = p.selftext ? stripHtml(p.selftext) : '';
      out.push({
        source: 'reddit',
        platform: 'reddit',
        language: kw.lang,
        keyword: kw.term,
        title: stripHtml(p.title || '(sans titre)'),
        url,
        snippet: truncate(body || `r/${p.subreddit} — ${p.title}`),
        author: p.author ? `u/${p.author} (r/${p.subreddit})` : `r/${p.subreddit}`,
        publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      });
    }
  }
  return out;
}
