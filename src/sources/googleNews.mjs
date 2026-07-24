// Source : Google News RSS (gratuit, sans clé). Couvre presse / blogs indexés.
// Une requête par mot-clé, localisée selon la langue (EN vs PT-PT).
import { XMLParser } from 'fast-xml-parser';
import { fetchText, stripHtml, truncate, sleep } from '../util.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function localeParams(lang) {
  return lang === 'pt'
    ? { hl: 'pt-PT', gl: 'PT', ceid: 'PT:pt' }
    : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
}

function buildUrl({ term, lang, phrase }) {
  const q = phrase ? `"${term}"` : term;
  const { hl, gl, ceid } = localeParams(lang);
  const params = new URLSearchParams({ q, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

// Google News enveloppe le vrai titre sous la forme "Titre - Source".
function splitSource(title = '') {
  const idx = title.lastIndexOf(' - ');
  if (idx > 0) return { title: title.slice(0, idx).trim(), source: title.slice(idx + 3).trim() };
  return { title: title.trim(), source: '' };
}

export async function collectGoogleNews(keywords) {
  const out = [];
  for (const kw of keywords) {
    const xml = await fetchText(buildUrl(kw));
    await sleep(400); // politesse
    if (!xml) continue;

    let doc;
    try {
      doc = parser.parse(xml);
    } catch (err) {
      console.warn(`[googleNews] parse XML échoué :: ${kw.term} :: ${err}`);
      continue;
    }

    const items = doc?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];
    for (const it of list) {
      const { title, source } = splitSource(stripHtml(it.title || ''));
      const url = (it.link || '').trim();
      if (!url || !title) continue;
      out.push({
        source: 'google_news',
        platform: 'news',
        language: kw.lang,
        keyword: kw.term,
        title,
        url,
        snippet: truncate(stripHtml(it.description || title)),
        author: source || (it.source?.['#text'] ?? ''),
        publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      });
    }
  }
  return out;
}
