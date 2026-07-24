# Veille ibis Lisboa Centro Saldanha — colonie de chats d'Arroios

Veille social media **proactive** et **100 % gratuite** sur un sujet à risque réputationnel latent :
l'hôtel **ibis Lisboa Centro Saldanha** en lien avec une **colonie de chats** située à proximité.
Surveillance EN + PT, canaux *owned* et *earned*, **2×/jour**, avec **dashboard** et **alerte automatique**.

- **Collecte** : GitHub Actions (cron 2×/jour) exécute `src/collect.mjs`.
- **Stockage** : fichiers JSON versionnés dans `docs/data/` (pas de base de données).
- **Dashboard** : site statique dans `docs/`, servi par **GitHub Pages**.
- **Alerte** : bandeau sur le dashboard **+** création/mise à jour automatique d'une **Issue GitHub** (= e-mail) dès qu'une *nouvelle* mention atteint le seuil de risque.

## Sources

| Source | Automatisé | Notes |
|---|---|---|
| Google News RSS (EN + PT) | ✅ | Presse / blogs indexés, sans clé. Source principale. |
| Reddit | ⚠️ best-effort | Recherche publique `.json`. Reddit bloque souvent les IP de datacenter (dont les runners GitHub Actions) → peut ne rien remonter. Dégradation propre (0 mention, pas d'erreur). |
| Bluesky | ✅ | API publique `searchPosts` (fonctionne depuis un réseau standard). |
| Mastodon | ✅ (best-effort) | Timelines de hashtags publiques (pas de recherche plein-texte sans auth). |
| **Instagram / Facebook / X** | ❌ | **Pas d'accès gratuit fiable.** Traités via le **panneau de veille manuelle** du dashboard (liens de recherche directs) + ce qui remonte en *earned* via l'actualité. |

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

Cron `0 8 * * *` et `0 16 * * *` (**UTC**). Lisbonne :
- **Été (WEST, UTC+1)** → **09h / 17h** locales.
- **Hiver (WET, UTC+0)** → **08h / 16h** locales.

Pour changer les heures, éditer les `cron:` dans `.github/workflows/veille.yml`.

## Limites (honnêtes)

- Instagram / Facebook / X : **non automatisés** (panneau manuel).
- Mastodon : couverture *best-effort* (hashtags).
- Google News RSS : contenus **indexés**, avec une légère latence — pas un crawl exhaustif.
- Classification **par règles** : indicative. La relecture du **snippet réel** reste la référence
  (sévérité = sensibilité du sujet × diffusion, jamais le simple comptage).

### Évolutions possibles
LLM gratuit pour affiner la classification · connecteur Slack/e-mail dédié · API Instagram Graph
(si les comptes ibis concernés sont détenus/gérés) · élargissement des mots-clés et hashtags.
