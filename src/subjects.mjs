// Définition des SUJETS de veille (un onglet du dashboard = un sujet).
// Chaque sujet est autonome : ses mots-clés, ses hashtags, son panneau manuel,
// et son `topic` (règles de risque) — voir classifyRisk() dans classify.mjs.
import { TOPIC_CATS, TOPIC_BRAND, SENSITIVE } from './classify.mjs';

// ────────────────────────────────────────────────────────────────────────
// Sujet 1 — ibis Lisboa Centro Saldanha × colonie de chats d'Arroios
// ────────────────────────────────────────────────────────────────────────
const SALDANHA = {
  id: 'saldanha-chats',
  label: 'ibis Saldanha · chats',
  description: 'ibis Lisboa Centro Saldanha & colonie de chats d’Arroios',
  keywords: [
    // Anglais
    { term: 'ibis Lisboa Centro Saldanha', lang: 'en', phrase: true },
    { term: 'ibis Lisboa Saldanha', lang: 'en', phrase: true },
    { term: 'Arroios cat colony', lang: 'en', phrase: true },
    { term: 'cat colony Lisbon', lang: 'en', phrase: true },
    { term: 'cat colony Saldanha', lang: 'en', phrase: true },
    { term: 'Arroios Parish Council', lang: 'en', phrase: true },
    { term: 'Lisbon Animal House', lang: 'en', phrase: true },
    // Portugais
    { term: 'ibis Lisboa Centro Saldanha', lang: 'pt', phrase: true },
    { term: 'ibis Lisboa Saldanha', lang: 'pt', phrase: true },
    { term: 'colónia de gatos Arroios', lang: 'pt', phrase: true },
    { term: 'colonia de gatos Arroios', lang: 'pt', phrase: true },
    { term: 'colónia de gatos Saldanha', lang: 'pt', phrase: true },
    { term: 'colonia de gatos Lisboa', lang: 'pt', phrase: true },
    { term: 'Junta de Freguesia de Arroios', lang: 'pt', phrase: true },
    { term: 'Casa dos Animais de Lisboa', lang: 'pt', phrase: true },
    // Termes de marque (larges, PT + EN)
    ...['ibis', 'ibishotels', 'ibishotel', 'ibis hotel', 'hotel ibis', 'ibis styles', 'ibis budget']
      .flatMap((term) => [
        { term, lang: 'pt', phrase: true },
        { term, lang: 'en', phrase: true },
      ]),
  ],
  hashtags: [
    'ibisLisboa', 'ibisSaldanha', 'Saldanha', 'Arroios', 'gatosdeLisboa',
    'coloniadegatos', 'colóniadegatos', 'CasadosAnimaisdeLisboa', 'animaisLisboa',
  ],
  topic: { primary: TOPIC_CATS, brand: TOPIC_BRAND, sensitive: SENSITIVE },
  manualWatch: [
    { label: 'ibis Lisboa Centro Saldanha', query: 'ibis Lisboa Centro Saldanha' },
    { label: 'colónia de gatos Arroios', query: 'colónia de gatos Arroios' },
    { label: 'colónia de gatos Saldanha', query: 'colónia de gatos Saldanha' },
    { label: 'Casa dos Animais de Lisboa', query: 'Casa dos Animais de Lisboa' },
  ],
};

// ────────────────────────────────────────────────────────────────────────
// Sujet 2 — Incendies en Gironde × hôtels Accor évacués/impactés
// ────────────────────────────────────────────────────────────────────────

// Sujet définissant : incendies / feux de forêt (FR + EN).
const FIRE_PRIMARY = [
  'incendie', 'incendies', 'feu de foret', 'feux de foret', 'feu de forêt', 'feux de forêt',
  'feu', 'feux', 'flammes', 'brasier', 'megafeu', 'mégafeu',
  'wildfire', 'wildfires', 'bushfire', 'forest fire', 'fire',
];
// Termes à risque / impact (escalateurs).
const FIRE_SENSITIVE = [
  'evacuation', 'évacuation', 'evacuations', 'évacuations', 'evacue', 'évacué', 'evacues',
  'évacués', 'evacuee', 'évacuée', 'evacuees', 'évacuées', 'evacuated', 'evacuate',
  'fermeture', 'fermetures', 'ferme', 'confinement', 'relogement', 'reloges', 'relogés',
  'sinistre', 'sinistres', 'sinistré', 'sinistrés', 'blesse', 'blessé', 'blesses', 'blessés',
  'victime', 'victimes', 'mort', 'morts', 'disparu', 'disparus', 'urgence', 'alerte', 'danger',
];
// Marques Accor + lieux de la zone impactée (Bordeaux / Gironde).
const ACCOR_BRAND = [
  'ibis', 'novotel', 'mercure', 'greet', 'accor',
  'bordeaux', 'merignac', 'mérignac', 'gironde', 'saint medard', 'saint médard',
  'st medard', 'st médard', 'st. medard', 'aeroport', 'aéroport', 'airport',
  'arcachon', 'la teste', 'landiras',
];

const GIRONDE = {
  id: 'gironde-incendies',
  label: 'Incendies Gironde · Accor',
  description: 'Incendies en Gironde & hôtels Accor évacués / impactés',
  keywords: [
    // Volet 1 — sanity check global incendies / évacuations (FR + EN)
    { term: 'incendies Gironde', lang: 'fr', phrase: true },
    { term: 'incendie Gironde', lang: 'fr', phrase: true },
    { term: 'feu de forêt Gironde', lang: 'fr', phrase: true },
    { term: 'incendie Bordeaux', lang: 'fr', phrase: true },
    { term: 'incendie Mérignac', lang: 'fr', phrase: true },
    { term: 'évacuation Gironde', lang: 'fr', phrase: true },
    { term: 'évacuation hôtel Bordeaux', lang: 'fr', phrase: true },
    { term: 'hôtels évacués Gironde', lang: 'fr', phrase: true },
    { term: 'Gironde wildfire', lang: 'en', phrase: true },
    { term: 'Bordeaux wildfire', lang: 'en', phrase: true },
    { term: 'Bordeaux hotel evacuation', lang: 'en', phrase: true },
    // Volet 2 — hôtels impactés nommément
    { term: 'Mercure Bordeaux Airport', lang: 'fr', phrase: true },
    { term: 'Mercure Bordeaux Aéroport', lang: 'fr', phrase: true },
    { term: 'ibis budget Bordeaux Aéroport', lang: 'fr', phrase: true },
    { term: 'ibis Styles Bordeaux Aéroport', lang: 'fr', phrase: true },
    { term: 'Novotel Mérignac', lang: 'fr', phrase: true },
    { term: 'Novotel Bordeaux Mérignac', lang: 'fr', phrase: true },
    { term: 'greet Bordeaux Aéroport', lang: 'fr', phrase: true },
    { term: 'ibis Styles Bordeaux Saint Médard', lang: 'fr', phrase: true },
  ],
  hashtags: [
    'Gironde', 'incendie', 'incendies', 'feudeforet', 'IncendiesGironde',
    'Bordeaux', 'Merignac', 'Accor',
  ],
  topic: { primary: FIRE_PRIMARY, brand: ACCOR_BRAND, sensitive: FIRE_SENSITIVE },
  // Volet 2 — comptes/pages à vérifier directement (non collectables automatiquement).
  manualWatch: [
    { label: 'Mercure Bordeaux Airport (H1508)', instagram: 'mercure_bordeaux_aeroport', query: 'Mercure Bordeaux Airport' },
    { label: 'ibis budget Bordeaux Airport (H7508)', instagram: 'ibis_budget_bordeaux_aeroport', query: 'ibis budget Bordeaux Airport' },
    { label: 'ibis Styles Bordeaux Airport (H2079)', instagram: 'ibis_styles_bordeaux_aeroport', query: 'ibis Styles Bordeaux Airport' },
    { label: 'Novotel Mérignac (H0402)', facebook: 'Novotel Bordeaux Mérignac', query: 'Novotel Mérignac Bordeaux', note: 'Compte Instagram officiel non identifié — page Facebook existante' },
    { label: 'greet Bordeaux Airport (HB7B1)', query: 'greet Bordeaux Airport', note: 'Compte Instagram officiel non identifié' },
    { label: 'ibis Styles Bordeaux St. Médard (H7208)', facebook: 'ibis styles Bordeaux St Médard', query: 'ibis Styles Bordeaux Saint Médard', note: 'Compte Instagram officiel non identifié — page Facebook existante' },
  ],
};

export const SUBJECTS = [SALDANHA, GIRONDE];
