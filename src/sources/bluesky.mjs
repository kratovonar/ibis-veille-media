// Source : Bluesky (AT Protocol) — endpoint public searchPosts, gratuit, sans auth.
import { fetchJson, truncate, sleep } from '../util.mjs';

function buildUrl({ term, phrase }) {
  // L'API accepte les guillemets pour une expression exacte.
  const q = phrase ? `"${term}"` : term;
  const params = new URLSearchParams({ q, limit: '25', sort: 'latest' });
  return `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params.toString()}`;
}

// Construit l'URL web publique d'un post à partir de son URI at://did/app.bsky.feed.post/rkey
function postWebUrl(uri, handle) {
  const rkey = uri?.split('/').pop();
  if (!rkey || !handle) return null;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export async function collectBluesky(keywords) {
  const out = [];
  for (const kw of keywords) {
    const data = await fetchJson(buildUrl(kw));
    await sleep(500);
    const posts = data?.posts;
    if (!Array.isArray(posts)) continue;

    for (const p of posts) {
      const handle = p?.author?.handle;
      const text = p?.record?.text || '';
      const url = postWebUrl(p?.uri, handle);
      if (!url || !text) continue;
      out.push({
        source: 'bluesky',
        platform: 'bluesky',
        language: kw.lang,
        keyword: kw.term,
        title: truncate(text, 120),
        url,
        snippet: truncate(text),
        author: p?.author?.displayName ? `${p.author.displayName} (@${handle})` : `@${handle}`,
        publishedAt: p?.record?.createdAt ? new Date(p.record.createdAt).toISOString() : null,
      });
    }
  }
  return out;
}
