// Source : Mastodon — timelines de hashtags publiques (best-effort, gratuit, sans auth).
// La recherche plein-texte Mastodon exige une authentification et reste locale à l'instance ;
// on se rabat donc sur les timelines de tags, disponibles publiquement. On interroge quelques
// grandes instances pour élargir la couverture (chacune n'indexe que ce qu'elle a "vu").
import { fetchJson, stripHtml, truncate, sleep } from '../util.mjs';

const INSTANCES = ['mastodon.social', 'mas.to', 'mastodon.online'];

function tagUrl(instance, tag) {
  const params = new URLSearchParams({ limit: '20' });
  return `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?${params.toString()}`;
}

// Devine la langue depuis le champ `language` du statut, sinon "und" (indéterminé).
function guessLang(status) {
  const l = (status?.language || '').toLowerCase();
  if (l.startsWith('pt')) return 'pt';
  if (l.startsWith('en')) return 'en';
  return 'und';
}

export async function collectMastodon(hashtags) {
  const out = [];
  const seen = new Set();
  for (const tag of hashtags) {
    for (const instance of INSTANCES) {
      const data = await fetchJson(tagUrl(instance, tag));
      await sleep(400);
      if (!Array.isArray(data)) continue;

      for (const s of data) {
        const url = s?.url || s?.uri;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const text = stripHtml(s?.content || '');
        if (!text) continue;
        out.push({
          source: 'mastodon',
          platform: 'mastodon',
          language: guessLang(s),
          keyword: `#${tag}`,
          title: truncate(text, 120),
          url,
          snippet: truncate(text),
          author: s?.account?.acct ? `@${s.account.acct}` : '',
          publishedAt: s?.created_at ? new Date(s.created_at).toISOString() : null,
        });
      }
    }
  }
  return out;
}
