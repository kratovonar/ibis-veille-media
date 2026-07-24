// Mots-clés de la veille, tagués par langue.
// `phrase: true` => l'expression est recherchée entre guillemets (correspondance exacte).
// Les deux premiers termes ("ibis Lisboa Centro Saldanha" / "ibis Lisboa Saldanha")
// sont volontairement suivis dans les DEUX langues (mêmes chaînes, localisation RSS différente).

export const KEYWORDS = [
  // --- Anglais ---
  { term: 'ibis Lisboa Centro Saldanha', lang: 'en', phrase: true },
  { term: 'ibis Lisboa Saldanha', lang: 'en', phrase: true },
  { term: 'Arroios cat colony', lang: 'en', phrase: true },
  { term: 'cat colony Lisbon', lang: 'en', phrase: true },
  { term: 'cat colony Saldanha', lang: 'en', phrase: true },
  { term: 'Arroios Parish Council', lang: 'en', phrase: true },
  { term: 'Lisbon Animal House', lang: 'en', phrase: true },

  // --- Portugais ---
  { term: 'ibis Lisboa Centro Saldanha', lang: 'pt', phrase: true },
  { term: 'ibis Lisboa Saldanha', lang: 'pt', phrase: true },
  { term: 'colónia de gatos Arroios', lang: 'pt', phrase: true },
  { term: 'colonia de gatos Arroios', lang: 'pt', phrase: true },
  { term: 'colónia de gatos Saldanha', lang: 'pt', phrase: true },
  { term: 'colonia de gatos Lisboa', lang: 'pt', phrase: true },
  { term: 'Junta de Freguesia de Arroios', lang: 'pt', phrase: true },
  { term: 'Casa dos Animais de Lisboa', lang: 'pt', phrase: true },

  // --- Termes de marque (larges — captent la marque Accor au sens global, plus bruités) ---
  // Suivis dans les DEUX langues (localisation RSS pt-PT + en-US) pour couvrir
  // la presse portugaise ET internationale.
  { term: 'ibis', lang: 'pt', phrase: true },
  { term: 'ibishotels', lang: 'pt', phrase: true },
  { term: 'ibishotel', lang: 'pt', phrase: true },
  { term: 'ibis hotel', lang: 'pt', phrase: true },
  { term: 'hotel ibis', lang: 'pt', phrase: true },
  { term: 'ibis styles', lang: 'pt', phrase: true },
  { term: 'ibis budget', lang: 'pt', phrase: true },

  { term: 'ibis', lang: 'en', phrase: true },
  { term: 'ibishotels', lang: 'en', phrase: true },
  { term: 'ibishotel', lang: 'en', phrase: true },
  { term: 'ibis hotel', lang: 'en', phrase: true },
  { term: 'hotel ibis', lang: 'en', phrase: true },
  { term: 'ibis styles', lang: 'en', phrase: true },
  { term: 'ibis budget', lang: 'en', phrase: true },
];

// Hashtags (sans #) dérivés pour Mastodon (recherche par timeline de tag).
// Mastodon indexe des tags simples, pas des expressions — on cible les entités clés.
export const HASHTAGS = [
  'ibisLisboa',
  'ibisSaldanha',
  'Saldanha',
  'Arroios',
  'gatosdeLisboa',
  'coloniadegatos',
  'colóniadegatos',
  'CasadosAnimaisdeLisboa',
  'animaisLisboa',
];

// Requête libre pour le panneau de veille manuelle (Instagram / Facebook / X).
export const MANUAL_QUERIES = [
  'ibis Lisboa Centro Saldanha',
  'colónia de gatos Arroios',
  'colónia de gatos Saldanha',
  'Casa dos Animais de Lisboa',
];
