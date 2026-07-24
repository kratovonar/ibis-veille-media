// Petits utilitaires partagés (fetch résilient, normalisation, hachage stable).
import { createHash } from 'node:crypto';

export const USER_AGENT =
  'ibis-veille-media/1.0 (+https://github.com/) social-listening watch bot';

// fetch avec timeout + User-Agent. Ne jette jamais : renvoie null en cas d'échec,
// pour qu'une source en panne n'interrompe pas tout le passage.
export async function safeFetch(url, { timeoutMs = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn(`[fetch] ${res.status} ${res.statusText} :: ${url}`);
      return null;
    }
    return res;
  } catch (err) {
    console.warn(`[fetch] échec :: ${url} :: ${err?.name || err}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(url, opts) {
  const res = await safeFetch(url, opts);
  return res ? await res.text() : null;
}

export async function fetchJson(url, opts) {
  const res = await safeFetch(url, opts);
  if (!res) return null;
  try {
    return await res.json();
  } catch (err) {
    console.warn(`[json] parse échoué :: ${url} :: ${err}`);
    return null;
  }
}

// Retire les balises HTML et décode quelques entités courantes.
export function stripHtml(s = '') {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s = '', n = 320) {
  const clean = String(s).trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

// Normalise une URL pour la déduplication : minuscule l'hôte, retire le slash final,
// et supprime les paramètres de tracking usuels.
export function normalizeUrl(raw = '') {
  try {
    const u = new URL(raw);
    u.hash = '';
    const drop = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'ref', 'ref_src', 'oc',
    ];
    for (const p of drop) u.searchParams.delete(p);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    let s = u.toString();
    s = s.replace(/\/$/, '');
    return s;
  } catch {
    return String(raw).trim();
  }
}

// Identifiant stable d'une mention : plateforme + URL normalisée (ou contenu si pas d'URL).
export function makeId(platform, url, fallback = '') {
  const key = url ? normalizeUrl(url) : `${platform}:${fallback}`;
  return createHash('sha1').update(`${platform}|${key}`).digest('hex').slice(0, 16);
}

// Attente simple (throttle entre requêtes pour rester poli avec les API publiques).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
