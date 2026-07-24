# Plan — Dashboard de veille social media : ibis Lisboa Centro Saldanha / colonie de chats

## Contexte

Mise en place d'une **veille proactive** sur un sujet à risque réputationnel latent : l'hôtel
**ibis Lisboa Centro Saldanha** en lien avec une **colonie de chats** située à proximité.
Aujourd'hui : **aucune couverture médiatique ni activité sociale identifiée** — l'objectif est de
détecter *toute évolution le plus tôt possible*, en anglais et en portugais, sur les canaux
*owned* et *earned*, et d'alerter rapidement.

Projet **from scratch**, **100 % gratuit**, **autonome** dans son propre dossier
`C:\Antigravity Workspace\ibis veille media` (aucune interaction avec `Michelin/` ni
`football-predictor/`). Choix validés avec l'utilisateur :
- **Stack** : GitHub Actions (cron) + GitHub Pages (dashboard statique) — toujours actif, 0 €, sans serveur ni base de données.
- **Sources auto** : Google News RSS (EN+PT), Reddit, Bluesky, Mastodon.
- **Cadence** : 2×/jour. **Reporting** : un rapport à *chaque* passage (y compris « RAS »).
- **Alerte** : dashboard custom + création automatique d'une **Issue GitHub** (= notification e-mail) en cas d'ALERTE.

### Contraintes assumées (à communiquer au client)
- **Instagram / Facebook / X (Twitter)** : **pas de monitoring automatique gratuit fiable** (X a fermé son API gratuite ; Meta exige la Graph API + la propriété des comptes). → traités via un **panneau de veille manuelle** (liens de recherche directs) + ce qui remonte en *earned* via l'actualité indexée. La demande « alerter sur les comptes ibis Instagram » est donc couverte en *best-effort* (mentions indexées) + vérification humaine assistée.
- **Mastodon** : la recherche plein-texte est limitée ; couverture *best-effort* via timelines de hashtags des instances publiques.
- **Google News RSS** : couvre les contenus **indexés** (presse, blogs), avec une légère latence ; ce n'est pas un crawl exhaustif du web.
- **Classification (risque/sentiment)** : à base de **règles** (gratuit, pas de LLM payant) → indicative, la relecture humaine du snippet reste la référence.

## Architecture (100 % gratuit, toujours actif)

```
GitHub Actions  (cron 0 8 * * *  et  0 16 * * *  UTC  +  déclenchement manuel)
   └─ node src/collect.mjs
        ├─ Sources : Google News RSS (EN+PT), Reddit JSON, Bluesky API, Mastodon (hashtags)
        ├─ Normalise → déduplique vs docs/data/state.json  → marque isNew
        ├─ Classe : owned/earned, risque HIGH/MODERATE/LOW, sentiment (règles)
        ├─ Statut du run : ALERTE si nouvelle mention risque ≥ MODÉRÉ, sinon RAS
        └─ Écrit docs/data/{latest,runs,mentions,state}.json  → git commit & push
   └─ Étape "alerte" : si statut = ALERTE → crée/actualise une Issue GitHub (e-mail auto)
GitHub Pages sert /docs  → dashboard statique (fetch ./data/*.json)
```

Aucune base de données, aucun secret externe, aucun compte payant. Les données vivent en JSON
versionné dans le repo ; le dashboard est un site statique qui les lit.

## Modèle de données (fichiers JSON dans `docs/data/`)

- **`state.json`** — index de dédup : `{ <id|url normalisé>: { firstSeenAt } }`. Sert de mémoire entre les passages.
- **`mentions.json`** — liste roulante (cap ~500) des mentions :
  `{ id, source, platform, language, keyword, title, url, snippet, author, publishedAt, firstSeenAt, sourceType (owned|earned), risk (HIGH|MODERATE|LOW), sentiment }`.
- **`runs.json`** — historique des passages (timeline) : `{ ranAt, status (ALERT|RAS), nNew, nTotal, byRisk }`.
- **`latest.json`** — résumé du dernier passage : statut, horodatage, `newMentions[]`, compteurs, prochaine exécution prévue.

**Baseline** : au **tout premier passage**, `state.json` est vide → on **amorce la référence** (les
mentions trouvées sont enregistrées comme *baseline*, statut RAS, **pas d'alerte de masse**). Les
alertes ne se déclenchent qu'à partir des **nouvelles** mentions des passages suivants.

## Composants à construire

### Collecte — `src/`
- **`keywords.mjs`** — les 16 mots-clés, tagués par langue (EN/PT). Requêtes RSS avec `hl=en-US` et `hl=pt-PT&gl=PT`, guillemets conservés pour les expressions exactes.
- **`sources/googleNews.mjs`** — `https://news.google.com/rss/search?q=<kw>&hl=<lang>` ; parse XML (`fast-xml-parser`, seule dépendance runtime ; `fetch` natif Node 20+).
- **`sources/reddit.mjs`** — `https://www.reddit.com/search.json?q=<kw>&sort=new&limit=25` (JSON, User-Agent requis).
- **`sources/bluesky.mjs`** — `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<kw>` (JSON public, sans auth).
- **`sources/mastodon.mjs`** — timelines de hashtags publiques (`/api/v1/timelines/tag/:tag`) sur instance(s) publiques ; *best-effort*.
- **`classify.mjs`** — règles : `sourceType` (owned si domaine ∈ {all.accor.com, accor.com, ibis.com, handles officiels}, sinon earned) ; `risk` via lexique croisant sujet (ibis/hotel + colonie/chats) et termes sensibles EN/PT (`cruelty, poison, eviction, protest, petition` / `maus-tratos, envenenamento, despejo, abandono, petição, protesto`) ; `sentiment` lexique simple. Principe repris de la méthodo Michelin : sévérité = sensibilité du sujet × diffusion, ne jamais se fier au simple comptage, toujours conserver le snippet réel pour relecture.
- **`store.mjs`** — lecture/écriture des JSON, dédup via `state.json`, cap de `mentions.json`, calcul du statut de run.
- **`collect.mjs`** — orchestrateur : boucle sources × mots-clés → normalise → dédup → classe → écrit les 4 fichiers → code retour indiquant ALERTE/RAS pour l'étape workflow.

### Planification & alerte — `.github/workflows/veille.yml`
- `on.schedule` : `cron: '0 8 * * *'` **et** `cron: '0 16 * * *'` (UTC) + `workflow_dispatch` (bouton manuel).
- Étapes : checkout → setup-node 20 → `npm ci` → `node src/collect.mjs` → si `latest.json.status == ALERT` créer/mettre à jour une **Issue GitHub** (via `actions/github-script`) listant les nouvelles mentions → commit & push de `docs/data/*` (avec `Read and write` permissions activées).
- **Fuseau** : Lisbonne en été (WEST, UTC+1) → 08:00/16:00 UTC = **09h/17h** locales ; en hiver (WET, UTC+0) → 08h/16h locales. (À noter dans le README ; ajustable.)

### Dashboard — `docs/` (servi par GitHub Pages, statique, sans build)
`index.html` + `app.js` + `styles.css` (JS vanilla, `fetch ./data/*.json`), interface **en français**, responsive, thème clair/sombre :
1. **Hero statut** : badge géant **ALERTE** (rouge) / **RAS** (vert), horodatage du dernier passage, prochaine exécution, total de mentions suivies.
2. **Bannière d'alerte** (si ALERTE) : liste des nouvelles mentions à risque ≥ MODÉRÉ avec liens.
3. **Timeline des passages** : tableau des runs récents (date, statut, #nouvelles, #total) — prouve que la veille tourne à chaque cycle (« rapport à chaque passage »).
4. **Table des mentions** : mot-clé, langue, owned/earned, plateforme, titre (lien), risque, sentiment, 1re détection ; **filtres** langue (EN/PT) / source / plateforme / risque / « nouvelles seulement » ; tri du plus récent.
5. **Panneau veille manuelle Instagram / Facebook / X** : liens de recherche directs (hashtags/lieu Instagram, recherche Facebook, recherche X) pour les termes clés + rappel « non automatisé », plus les mentions *earned* évoquant Instagram.

## Arborescence du projet

```
ibis veille media/
  PLAN.md                       # copie de ce plan (créée à l'étape 1)
  README.md                     # fonctionnement + étapes de setup + note fuseau/limites
  package.json                  # type:module ; deps: fast-xml-parser ; scripts: collect, serve
  .gitignore
  src/
    keywords.mjs
    collect.mjs
    store.mjs
    classify.mjs
    sources/{googleNews,reddit,bluesky,mastodon}.mjs
  docs/                         # racine GitHub Pages
    index.html
    app.js
    styles.css
    data/.gitkeep               # latest/runs/mentions/state.json générés
  .github/workflows/veille.yml
```

## Étapes de mise en place (à l'exécution, hors plan mode)

1. Créer le dossier `C:\Antigravity Workspace\ibis veille media` et **y copier ce plan en `PLAN.md`** (demande explicite de l'utilisateur).
2. Scaffolder les fichiers ci-dessus ; `npm install fast-xml-parser`.
3. **Test local** : `node src/collect.mjs` → inspecter `docs/data/*.json` ; relancer → vérifier la dédup (pas de ré-alerte).
4. **Dashboard local** : `npx serve docs` (ou `python -m http.server` dans `docs`) → ouvrir, vérifier hero / filtres / timeline / panneau manuel.
5. Créer le **repo GitHub**, `git push`.
6. **Activer GitHub Pages** : Settings → Pages → source = branche `main`, dossier `/docs`.
7. **Permissions Actions** : Settings → Actions → Workflow permissions → **Read and write** (commit des données + ouverture d'Issues).
8. Lancer une fois via **workflow_dispatch** pour amorcer la baseline ; vérifier le commit de données, la mise à jour du dashboard, et (en abaissant temporairement le seuil) la création d'une Issue d'alerte.

## Vérification (bout en bout)

- **Dédup / baseline** : 2 exécutions locales consécutives → la 2ᵉ ne re-signale pas les mêmes mentions ; le 1er run est une baseline sans alerte de masse.
- **Report à chaque passage** : un mot-clé sans résultat → le run est tout de même journalisé (statut RAS) dans `runs.json` et visible sur la timeline.
- **Alerte** : injection d'une mention à risque HIGH → statut ALERTE, bannière dashboard, et Issue GitHub créée (e-mail).
- **Pages en ligne** : après activation, l'URL GitHub Pages affiche le dashboard alimenté par les données du dernier run.
- **Cron** : 2 entrées cron présentes + note de fuseau (09h/17h Lisboa en été) ; `workflow_dispatch` fonctionne.

## Coût & limites

- **Coût : 0 €.** GitHub Actions (repo public : illimité ; privé : 2000 min/mois — 2 courts runs/jour = négligeable) + GitHub Pages gratuits. Aucun compte tiers.
- **Limites** (dans le README) : Instagram/Facebook/X non automatisés (panneau manuel) ; Mastodon best-effort ; classification par règles indicative ; RSS = contenus indexés avec latence. Évolutions possibles ultérieures : ajout d'un LLM gratuit pour la classification, connecteur Slack/e-mail dédié, ou API Instagram Graph si les comptes sont détenus.
