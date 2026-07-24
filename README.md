# Veille ibis Lisboa Centro Saldanha — colonie de chats d'Arroios

Veille social media **proactive** et **100 % gratuite** sur un sujet à risque réputationnel latent :
l'hôtel **ibis Lisboa Centro Saldanha** en lien avec une **colonie de chats** située à proximité.
Surveillance EN + PT, canaux *owned* et *earned*, **2×/jour**, avec **dashboard** et **alerte automatique**.

- **Collecte** : GitHub Actions (cron 2×/jour) exécute `src/collect.mjs`.
- **Stockage** : fichiers JSON versionnés dans `docs/data/` (pas de base de données).
- **Dashboard** : site statique dans `docs/`, servi par **GitHub Pages**.
- **Alerte** : bandeau sur le dashboard **+** création/mise à jour automatique d'une **Issue GitHub** (= e-mail) dès qu'une *nouvelle* mention atteint le seuil de risque.

## Sources captées

Quatre sources interrogées **automatiquement** à chaque passage, en **anglais et portugais**, pour couvrir *owned* et *earned* :

| Source | Ce qui est capté | Statut | Détail technique |
|---|---|---|---|
| **Google News RSS** | Presse, blogs et sites d'actualité **indexés** (EN + PT). Source principale / la plus riche. | ✅ fiable | `news.google.com/rss/search`, 1 requête par mot-clé, localisée `hl=en-US` et `hl=pt-PT`. Sans clé. |
| **Bluesky** | Posts publics du réseau Bluesky mentionnant les mots-clés. | ✅ fiable | API publique `app.bsky.feed.searchPosts`. Sans auth. |
| **Mastodon** | Pouets publics portant les **hashtags** suivis (activisme, communautés locales). | ⚠️ best-effort | Timelines de tags publiques sur `mastodon.social`, `mas.to`, `mastodon.online`. Pas de recherche plein-texte sans compte → couverture par hashtags. |
| **Reddit** | Fils/discussions publics mentionnant les mots-clés. | ⚠️ best-effort | Recherche `.json`. Reddit bloque souvent les IP de datacenter (runners GitHub Actions) → peut ne rien remonter certains jours. Dégradation propre (0 mention, aucune erreur). |
| **Instagram / Facebook / X (Twitter)** | — | ❌ non automatisé | **Aucun accès gratuit fiable** (X a fermé son API gratuite ; Meta exige la Graph API + la propriété des comptes). Traités via le **panneau de veille manuelle** du dashboard (liens de recherche directs) + ce qui remonte en *earned* via l'actualité indexée. |

### Mots-clés suivis (Google News, Bluesky, Reddit)

Définis dans [`src/keywords.mjs`](src/keywords.mjs) — expressions exactes, EN + PT (les deux termes « ibis … Saldanha » sont suivis dans les deux langues) :

**Anglais** : `ibis Lisboa Centro Saldanha` · `ibis Lisboa Saldanha` · `Arroios cat colony` · `cat colony Lisbon` · `cat colony Saldanha` · `Arroios Parish Council` · `Lisbon Animal House`

**Portugais** : `ibis Lisboa Centro Saldanha` · `ibis Lisboa Saldanha` · `colónia de gatos Arroios` · `colonia de gatos Arroios` · `colónia de gatos Saldanha` · `colonia de gatos Lisboa` · `Junta de Freguesia de Arroios` · `Casa dos Animais de Lisboa`

**Termes de marque** (larges, plus bruités — captent la marque Accor au sens global ; suivis en **PT + EN**) : `ibis` · `ibishotels` · `ibishotel` · `ibis hotel` · `hotel ibis` · `ibis styles` · `ibis budget`

### Hashtags suivis (Mastodon)

`#ibisLisboa` · `#ibisSaldanha` · `#Saldanha` · `#Arroios` · `#gatosdeLisboa` · `#coloniadegatos` · `#colóniadegatos` · `#CasadosAnimaisdeLisboa` · `#animaisLisboa`

### Recherches du panneau manuel (Instagram / Facebook / X)

Liens générés sur le dashboard pour : `ibis Lisboa Centro Saldanha` · `colónia de gatos Arroios` · `colónia de gatos Saldanha` · `Casa dos Animais de Lisboa`.

> Pour élargir ou affiner la veille, il suffit d'éditer les listes dans [`src/keywords.mjs`](src/keywords.mjs).

## Fonctionnement

1. `collect.mjs` interroge chaque source pour les 16 mots-clés (`src/keywords.mjs`).
2. Chaque mention reçoit un **id stable** (plateforme + URL normalisée) et est **classée** par règles
   (`src/classify.mjs`) : `owned`/`earned`, risque `HIGH`/`MODERATE`/`LOW`, sentiment.
3. Déduplication contre `docs/data/state.json` → les mentions inédites sont marquées **nouvelles**.
4. **Statut du run** : `ALERT` si une *nouvelle* mention atteint le seuil (**MODERATE** par défaut,
   voir `ALERT_THRESHOLD` dans `src/store.mjs`), sinon `RAS`.
5. Écriture de `latest.json`, `runs.json`, `mentions.json`, `state.json` → commit & push.
6. Si `ALERT` : le workflow ouvre/actualise une Issue `veille-alerte`.

> **Baseline** : au tout premier passage, `state.json` est vide → les mentions trouvées amorcent la
> référence (statut `RAS`, **pas d'alerte de masse**). Les alertes ne partent qu'ensuite, sur les nouveautés.

## Données (`docs/data/`)

- `state.json` — index de déduplication `{ id: { firstSeenAt } }`.
- `mentions.json` — liste roulante (≤ 500) des mentions classées.
- `runs.json` — historique des passages (timeline).
- `latest.json` — résumé du dernier passage (statut, compteurs, nouvelles, liens manuels).

## Développement local

```bash
npm install           # génère package-lock.json (requis par le workflow)
npm run collect       # lance une collecte → écrit docs/data/*.json
npm run serve         # sert docs/ en local (http://localhost:3000)
```

Tests utiles :

```bash
# Dédup : relancer une 2e fois ne doit PAS re-signaler les mêmes mentions
npm run collect && npm run collect

# Alerte de démonstration (injecte une mention HIGH de test)
VEILLE_INJECT_TEST=1 npm run collect
```

## Mise en production (une seule fois)

1. Créer un dépôt GitHub et y pousser ce dossier (avec `package-lock.json`).
2. **Settings → Pages** : source = branche `main`, dossier `/docs`.
3. **Settings → Actions → General → Workflow permissions** : **Read and write permissions**.
4. Onglet **Actions → Veille ibis Saldanha → Run workflow** pour amorcer la baseline
   (cocher *inject test* pour vérifier le chemin d'alerte + l'Issue).
5. Le dashboard est en ligne à l'URL GitHub Pages du dépôt.

## Planification & fuseau

Cron `17 8 * * *` et `17 16 * * *` (**UTC**) — minutes décalées à `:17` volontairement,
car GitHub abandonne fréquemment les runs planifiés à l'heure pile (`:00`) en cas de charge.

Équivalent à Lisbonne :
- **Été (WEST, UTC+1)** → **09h17 / 17h17** locales.
- **Hiver (WET, UTC+0)** → **08h17 / 16h17** locales.

> **Affichage** : le dashboard affiche tous les horodatages en **UTC** (suffixe « UTC »),
> aligné sur le déclenchement du cron — pas d'ambiguïté de fuseau.

> **Note fiabilité** : le planificateur GitHub Actions est *best-effort* — un passage peut être
> retardé de quelques minutes, voire (rarement) sauté. Le passage suivant rattrape. Pour un
> déclenchement garanti à l'heure, on peut ajouter un pinger externe gratuit (voir *Évolutions*).

Pour changer les heures, éditer les `cron:` dans `.github/workflows/veille.yml`.

## Limites (honnêtes)

- Instagram / Facebook / X : **non automatisés** (panneau manuel).
- Mastodon : couverture *best-effort* (hashtags).
- Google News RSS : contenus **indexés**, avec une légère latence — pas un crawl exhaustif.
- Classification **par règles** : indicative. La relecture du **snippet réel** reste la référence
  (sévérité = sensibilité du sujet × diffusion, jamais le simple comptage).

### Évolutions possibles
LLM gratuit pour affiner la classification · connecteur Slack/e-mail dédié · API Instagram Graph
(si les comptes ibis concernés sont détenus/gérés) · élargissement des mots-clés et hashtags ·
**pinger externe gratuit** (ex. cron-job.org + Personal Access Token) appelant l'API
`workflow_dispatch` pour un déclenchement garanti à l'heure, indépendant du planificateur GitHub.
