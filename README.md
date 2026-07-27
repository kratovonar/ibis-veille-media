# Veille social media — multi-sujets (Accor)

Veille social media **proactive** et **100 % gratuite**, organisée en **sujets** (un onglet du
dashboard = un sujet). Surveillance multilingue, canaux *owned* et *earned*, **2×/jour**, avec
**dashboard** et **alerte automatique**.

- **Collecte** : GitHub Actions (cron 2×/jour) exécute `src/collect.mjs` pour **chaque sujet**.
- **Stockage** : fichiers JSON versionnés dans `docs/data/<sujet>/` (pas de base de données).
- **Dashboard** : site statique dans `docs/`, servi par **GitHub Pages**, avec un **onglet par sujet**.
- **Alerte** : bandeau sur le dashboard **+** création/mise à jour automatique d'une **Issue GitHub**
  (= e-mail) **par sujet** dès qu'une *nouvelle* mention récente atteint le seuil de risque.

## Sujets suivis (onglets)

Définis dans [`src/subjects.mjs`](src/subjects.mjs). Chaque sujet a ses mots-clés, ses hashtags,
son panneau de veille manuelle et ses **règles de risque** (`topic`).

| Sujet (onglet) | id | Portée |
|---|---|---|
| **ibis Saldanha · chats** | `saldanha-chats` | ibis Lisboa Centro Saldanha × colonie de chats d'Arroios (EN + PT). |
| **Incendies Gironde · Accor** | `gironde-incendies` | Incendies/évacuations en Gironde × hôtels Accor impactés (FR + EN). |

## Sources captées

Quatre sources interrogées **automatiquement** à chaque passage (par sujet), pour couvrir *owned* et *earned* :

| Source | Ce qui est capté | Statut | Détail technique |
|---|---|---|---|
| **Google News RSS** | Presse, blogs et sites d'actualité **indexés**. Source principale. | ✅ fiable | `news.google.com/rss/search`, 1 requête/mot-clé, localisée `hl=en-US` / `hl=pt-PT` / `hl=fr-FR`. Sans clé. |
| **Bluesky** | Posts publics mentionnant les mots-clés. | ✅ fiable | API publique `app.bsky.feed.searchPosts`. Sans auth. |
| **Mastodon** | Pouets publics portant les **hashtags** suivis. | ⚠️ best-effort | Timelines de tags publiques (`mastodon.social`, `mas.to`, `mastodon.online`). Pas de recherche plein-texte sans compte. |
| **Reddit** | Fils/discussions publics. | ⚠️ best-effort | Recherche `.json`. Reddit bloque souvent les IP de datacenter (runners GitHub Actions) → peut ne rien remonter. Dégradation propre (0 mention, aucune erreur). |
| **Instagram / Facebook / X** | — | ❌ non automatisé | **Aucun accès gratuit fiable.** Traités via le **panneau de veille manuelle** de chaque onglet (liens directs vers les comptes connus + recherches). |

## Règle de risque (par sujet)

Classement par règles dans [`src/classify.mjs`](src/classify.mjs), paramétré par le `topic` du sujet
(`primary` = sujet définissant, `brand` = marques/lieux, `sensitive` = termes à risque) :

| Risque | Condition | Alerte |
|---|---|---|
| **HIGH** | relève du **sujet** (`primary`) **ET** (terme à risque **OU** croise une marque/lieu concerné) | 🔴 oui |
| **MODERATE** | sujet seul, **ou** terme à risque hors sujet | ⚪ non |
| **LOW** | le reste | ⚪ non |

- **saldanha-chats** : `primary` = chats/animaux (multilingue EN/PT/FR/ES/IT/DE). Donc une mention
  n'alerte **que si elle parle de chats/animaux** + (risque ou ibis/Saldanha).
- **gironde-incendies** : `primary` = incendies/feux de forêt (FR/EN) ; `brand` = marques Accor +
  lieux (Bordeaux, Mérignac, Gironde, aéroport…) ; `sensitive` = évacuation, sinistre, victimes…
  Donc alerte sur **incendie × (évacuation/impact ou hôtel Accor/lieu)**.

Seuil d'alerte : **HIGH** par défaut (`ALERT_THRESHOLD` dans [`src/store.mjs`](src/store.mjs)).

### Fenêtre de récence des alertes

Seules les mentions **publiées dans les 30 derniers jours** peuvent déclencher une alerte — **fenêtre
glissante** recalculée à chaque passage (les vieux articles réindexés restent visibles dans la table
mais n'alertent pas). Réglages dans [`src/store.mjs`](src/store.mjs) : `ALERT_WINDOW_DAYS` (défaut 30,
surcharge `VEILLE_ALERT_WINDOW_DAYS`) ou `VEILLE_ALERT_SINCE` (date absolue). Une mention sans date de
publication est réputée récente.

## Déroulé d'un passage

Pour **chaque sujet** :
1. Collecte des 4 sources pour les mots-clés / hashtags du sujet.
2. Chaque mention reçoit un **id stable** (plateforme + URL normalisée) et est **classée** (owned/earned, risque, sentiment).
3. Déduplication contre `docs/data/<sujet>/state.json` → les inédites sont marquées **nouvelles**.
4. **Statut** : `ALERT` si une *nouvelle* mention **récente** atteint le seuil (HIGH), sinon `RAS`.
5. Écriture de `docs/data/<sujet>/{state,mentions,runs,latest}.json`.

Puis, globalement : `docs/data/subjects.json` (manifeste des onglets) et `docs/data/summary.json`
(état par sujet). Commit & push. Si un sujet est en `ALERT` → Issue GitHub `veille-alerte` dédiée.

> **Baseline** : au tout premier passage d'un sujet, `state.json` est vide → les mentions trouvées
> amorcent la référence (statut `RAS`, **pas d'alerte de masse**). Les alertes ne partent qu'ensuite.

## Données (`docs/data/`)

- `subjects.json` — manifeste des onglets `[{ id, label, description }]`.
- `summary.json` — état transverse `{ generatedAt, subjects:[{ id, status, nNew, byRisk… }] }`.
- `<sujet>/state.json` — index de déduplication `{ id: { firstSeenAt } }`.
- `<sujet>/mentions.json` — liste roulante (≤ 500) des mentions classées.
- `<sujet>/runs.json` — historique des passages (timeline).
- `<sujet>/latest.json` — résumé du dernier passage (statut, compteurs, nouvelles, panneau manuel).

## Ajouter / modifier un sujet

Tout se passe dans [`src/subjects.mjs`](src/subjects.mjs) : ajouter un objet au tableau `SUBJECTS`
avec `id`, `label`, `keywords` (avec `lang` : `en`/`pt`/`fr`), `hashtags`, `topic`
(`{ primary, brand, sensitive }`) et `manualWatch` (comptes/recherches à vérifier à la main). Le
nouvel onglet apparaît automatiquement sur le dashboard.

## Développement local

```bash
npm install                       # génère package-lock.json (requis par le workflow)
npm run collect                   # collecte tous les sujets → docs/data/<sujet>/*.json
npm run serve                     # sert docs/ en local (http://localhost:3000)

npm run collect && npm run collect        # test dédup (le 2e run ne re-signale pas les mêmes)
VEILLE_INJECT_TEST=1 npm run collect      # injecte une mention HIGH de test par sujet (démo alerte)
```

## Mise en production (une seule fois)

1. Pousser ce dossier sur un dépôt GitHub (avec `package-lock.json`).
2. **Settings → Pages** : source = branche `main`, dossier `/docs`.
3. **Settings → Actions → General → Workflow permissions** : **Read and write permissions**.
4. **Actions → Veille ibis Saldanha → Run workflow** pour amorcer la baseline (option *inject test*
   pour vérifier le chemin d'alerte + les Issues).
5. Dashboard en ligne à l'URL GitHub Pages du dépôt.

## Planification & fuseau

Cron `17 8 * * *` et `17 16 * * *` (**UTC**) — minutes à `:17` (GitHub abandonne souvent les runs à `:00`).
Lisbonne : **09h17 / 17h17** (été) ou **08h17 / 16h17** (hiver). Le dashboard affiche tout en **UTC**.

> Le planificateur GitHub Actions est *best-effort* (retards possibles, rares sauts) ; le passage
> suivant rattrape. Pour un déclenchement garanti : pinger externe (voir *Évolutions*).

## Limites (honnêtes)

- Instagram / Facebook / X : **non automatisés** (panneau manuel avec liens directs vers les comptes).
- Mastodon : couverture *best-effort* (hashtags).
- Google News RSS : contenus **indexés**, légère latence — pas un crawl exhaustif.
- Classification **par règles** : indicative. La relecture du **snippet réel** reste la référence.

### Évolutions possibles
LLM gratuit pour affiner la classification · connecteur Slack/e-mail dédié · API Instagram Graph
(si les comptes concernés sont détenus/gérés) · nouveaux sujets/onglets · **pinger externe gratuit**
(cron-job.org + PAT) appelant `workflow_dispatch` pour un déclenchement garanti à l'heure.
