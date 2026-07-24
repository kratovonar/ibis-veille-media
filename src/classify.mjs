// Classification par règles (gratuit, sans LLM). Volontairement indicatif :
// le snippet réel reste la référence pour la relecture humaine.
// Principe (repris de la méthodo de veille e-réputation) :
//   sévérité = sensibilité du sujet × diffusion — jamais le simple comptage.

// Domaines / handles considérés comme "owned" (canaux officiels de la marque).
const OWNED_DOMAINS = [
  'all.accor.com',
  'accor.com',
  'ibis.com',
  'ibishotel.com',
  'group.accor.com',
];
const OWNED_HANDLE_HINTS = ['ibis', 'accor', 'accorhotels'];

// Termes sensibles (déclencheurs de risque), EN + PT, en minuscule sans accent géré à part.
const SENSITIVE = [
  // EN
  'cruelty', 'abuse', 'poison', 'poisoned', 'killing', 'killed', 'dead', 'death',
  'eviction', 'evict', 'removed', 'removal', 'protest', 'petition', 'boycott',
  'neglect', 'starving', 'abandon', 'abandoned', 'scandal', 'complaint', 'outrage',
  'welfare', 'activist', 'activists', 'animal rights',
  // PT
  'maus-tratos', 'maus tratos', 'crueldade', 'abuso', 'veneno', 'envenenamento',
  'envenenado', 'envenenados', 'morte', 'mortos', 'mataram', 'matar',
  'despejo', 'despejar', 'remocao', 'remoção', 'protesto', 'peticao', 'petição',
  'boicote', 'abandono', 'abandonados', 'negligencia', 'negligência', 'escandalo',
  'escândalo', 'queixa', 'denuncia', 'denúncia', 'indignacao', 'indignação',
  'ativista', 'ativistas', 'bem-estar animal', 'direitos dos animais',
];

// Termes clairement négatifs (sentiment).
const NEGATIVE = [
  ...SENSITIVE,
  'bad', 'worst', 'terrible', 'awful', 'shame', 'disgusting', 'angry',
  'péssimo', 'pessimo', 'horrível', 'horrivel', 'vergonha', 'nojento', 'revoltante',
];
const POSITIVE = [
  'great', 'good', 'love', 'excellent', 'wonderful', 'thank', 'help', 'rescue', 'saved',
  'ótimo', 'otimo', 'bom', 'adorei', 'excelente', 'obrigado', 'obrigada', 'ajuda',
  'resgate', 'salvos', 'salvo',
];

// Entités du sujet.
const TOPIC_BRAND = ['ibis', 'accor', 'saldanha', 'arroios'];

// Chats / félins / animaux — élargi à plusieurs langues (le HIGH exige d'en trouver un).
// foldAccents() gère déjà les accents, donc « colónia » == « colonia ».
const TOPIC_CATS = [
  // EN
  'cat', 'cats', 'kitten', 'kittens', 'feline', 'felines', 'stray', 'strays', 'feral',
  'cat colony', 'colony', 'animal', 'animals', 'animal welfare', 'animal rights',
  // PT
  'gato', 'gatos', 'gata', 'gatas', 'gatinho', 'gatinhos', 'felino', 'felinos', 'felina',
  'colónia', 'colonia', 'colónia de gatos', 'animais', 'bem-estar animal',
  // FR
  'chat', 'chats', 'chaton', 'chatons', 'félin', 'colonie de chats',
  // ES
  'gatito', 'gatitos', 'colonia de gatos', 'felinos',
  // IT
  'gatto', 'gatti', 'gattino', 'colonia di gatti',
  // DE
  'katze', 'katzen',
];

function foldAccents(s = '') {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function hay(m) {
  return foldAccents(`${m.title || ''} ${m.snippet || ''} ${m.keyword || ''}`.toLowerCase());
}
function anyIn(text, list) {
  return list.some((w) => text.includes(foldAccents(w)));
}

export function classifySourceType(mention) {
  const url = (mention.url || '').toLowerCase();
  const author = (mention.author || '').toLowerCase();
  if (OWNED_DOMAINS.some((d) => url.includes(d))) return 'owned';
  if (mention.platform !== 'news' && OWNED_HANDLE_HINTS.some((h) => author.includes(h))) return 'owned';
  return 'earned';
}

export function classifySentiment(mention) {
  const t = hay(mention);
  const neg = NEGATIVE.reduce((n, w) => (t.includes(foldAccents(w)) ? n + 1 : n), 0);
  const pos = POSITIVE.reduce((n, w) => (t.includes(foldAccents(w)) ? n + 1 : n), 0);
  if (neg > pos) return 'négatif';
  if (pos > neg) return 'positif';
  return 'neutre';
}

// Risque — recentré sur les chats/animaux.
// RÈGLE : une mention n'est HIGH (= niveau d'alerte) QUE si elle parle de
// chats/animaux (TOPIC_CATS, toutes langues). Le reste ne déclenche pas d'alerte.
export function classifyRisk(mention) {
  const t = hay(mention);
  const onBrand = anyIn(t, TOPIC_BRAND);
  const onCats = anyIn(t, TOPIC_CATS);
  const sensitive = anyIn(t, SENSITIVE);

  // HIGH : parle de chats/animaux ET (terme à risque OU croise la marque/hôtel).
  if (onCats && (sensitive || onBrand)) return 'HIGH';
  // MODERATE : à surveiller mais pas alertant — chats seuls, ou terme à risque hors sujet chats.
  if (onCats || sensitive) return 'MODERATE';
  return 'LOW';
}

export function classify(mention) {
  return {
    ...mention,
    sourceType: classifySourceType(mention),
    sentiment: classifySentiment(mention),
    risk: classifyRisk(mention),
  };
}

// Ordre de gravité pour comparaisons/seuils.
export const RISK_ORDER = { LOW: 0, MODERATE: 1, HIGH: 2 };
