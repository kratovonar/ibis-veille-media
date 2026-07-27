// Persistance JSON + déduplication + calcul du statut de run.
// Tout vit dans docs/data/ (versionné, lu tel quel par le dashboard).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RISK_ORDER } from './classify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '..', 'docs', 'data');

const MENTIONS_CAP = 500; // liste roulante
const RUNS_CAP = 200;
const ALERT_THRESHOLD = 'HIGH'; // alerte uniquement sur les NOUVELLES mentions HIGH (= liées aux chats/animaux)

// Fenêtre de récence des alertes : n'alerter que sur les mentions publiées dans les
// N derniers jours (fenêtre GLISSANTE, recalculée à chaque passage). Défaut : 30 jours.
// Surcharge : VEILLE_ALERT_WINDOW_DAYS (nombre de jours) ou VEILLE_ALERT_SINCE (date absolue ISO).
const ALERT_WINDOW_DAYS = Number(process.env.VEILLE_ALERT_WINDOW_DAYS || 30);
const ALERT_SINCE_ABS = process.env.VEILLE_ALERT_SINCE || null;

// Calcule la date-plancher d'alerte pour ce passage (absolue si fournie, sinon now - N jours).
function computeAlertSince(nowIso) {
  if (ALERT_SINCE_ABS) return ALERT_SINCE_ABS;
  const now = Date.parse(nowIso);
  return new Date(now - ALERT_WINDOW_DAYS * 86400000).toISOString();
}

// Date effective d'une mention pour le test de récence : date de publication si connue,
// sinon date de première détection (une mention tout juste captée est réputée récente).
function isRecentEnough(m, alertSince) {
  const eff = m.publishedAt || m.firstSeenAt;
  if (!eff) return true; // aucune date : ne pas bloquer l'alerte
  return eff >= alertSince;
}

// Chaque sujet a son propre sous-dossier docs/data/<subjectId>/.
function subjectPaths(subjectId) {
  const dir = join(DATA_DIR, subjectId);
  return {
    state: join(dir, 'state.json'),
    mentions: join(dir, 'mentions.json'),
    runs: join(dir, 'runs.json'),
    latest: join(dir, 'latest.json'),
  };
}

async function readJson(p, fallback) {
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(p, obj) {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export async function loadStore(subjectId) {
  const paths = subjectPaths(subjectId);
  const [state, mentions, runs] = await Promise.all([
    readJson(paths.state, {}),
    readJson(paths.mentions, []),
    readJson(paths.runs, []),
  ]);
  return { state, mentions, runs, isFirstRun: Object.keys(state).length === 0 };
}

// Fusionne les mentions collectées (déjà classées) avec l'historique.
// Renvoie { newMentions, allMentions, status, byRisk, nNew, nTotal }.
export function reconcile({ state, mentions, collected, isFirstRun, nowIso }) {
  const known = { ...state };
  const byId = new Map(mentions.map((m) => [m.id, m]));
  const newMentions = [];

  for (const m of collected) {
    const seenBefore = Boolean(known[m.id]);
    if (seenBefore) {
      // déjà connue : on rafraîchit la classification mais on garde firstSeenAt
      const prev = byId.get(m.id);
      byId.set(m.id, {
        ...prev,
        ...m,
        firstSeenAt: prev?.firstSeenAt || known[m.id].firstSeenAt,
        isNew: false,
        baseline: prev?.baseline ?? false,
      });
    } else {
      known[m.id] = { firstSeenAt: nowIso };
      const record = {
        ...m,
        firstSeenAt: nowIso,
        isNew: !isFirstRun, // au 1er passage, on amorce la baseline sans "nouveauté"
        baseline: isFirstRun,
      };
      byId.set(m.id, record);
      if (!isFirstRun) newMentions.push(record);
    }
  }

  // Reclasse "isNew: false" toutes les mentions non revues ce passage (nouveauté = ce run only).
  const collectedIds = new Set(collected.map((m) => m.id));
  let allMentions = [...byId.values()].map((m) =>
    collectedIds.has(m.id) ? m : { ...m, isNew: false }
  );

  // tri : plus récent d'abord (firstSeenAt puis publishedAt)
  allMentions.sort((a, b) => {
    const ka = a.firstSeenAt || a.publishedAt || '';
    const kb = b.firstSeenAt || b.publishedAt || '';
    return kb.localeCompare(ka);
  });
  allMentions = allMentions.slice(0, MENTIONS_CAP);

  const byRisk = { HIGH: 0, MODERATE: 0, LOW: 0 };
  for (const m of allMentions) byRisk[m.risk] = (byRisk[m.risk] || 0) + 1;

  const threshold = RISK_ORDER[ALERT_THRESHOLD];
  const alertSince = computeAlertSince(nowIso);
  const alerting = newMentions.filter(
    (m) => RISK_ORDER[m.risk] >= threshold && isRecentEnough(m, alertSince)
  );
  const status = alerting.length > 0 ? 'ALERT' : 'RAS';

  return {
    known,
    newMentions,
    alerting,
    allMentions,
    status,
    byRisk,
    alertSince,
    alertWindowDays: ALERT_SINCE_ABS ? null : ALERT_WINDOW_DAYS,
    nNew: newMentions.length,
    nTotal: allMentions.length,
  };
}

export async function persist(subjectId, { known, allMentions, runs, run, latest }) {
  const paths = subjectPaths(subjectId);
  const nextRuns = [run, ...runs].slice(0, RUNS_CAP);
  await Promise.all([
    writeJson(paths.state, known),
    writeJson(paths.mentions, allMentions),
    writeJson(paths.runs, nextRuns),
    writeJson(paths.latest, latest),
  ]);
}

// Manifeste des onglets (lu par le dashboard pour construire la navigation).
export async function writeManifest(subjects) {
  await writeJson(join(DATA_DIR, 'subjects.json'),
    subjects.map((s) => ({ id: s.id, label: s.label, description: s.description })));
}

// Résumé transverse (lu par le workflow pour ouvrir les Issues d'alerte par sujet).
export async function writeSummary(summaryRows, nowIso) {
  await writeJson(join(DATA_DIR, 'summary.json'), { generatedAt: nowIso, subjects: summaryRows });
}

export { ALERT_THRESHOLD, ALERT_WINDOW_DAYS };
