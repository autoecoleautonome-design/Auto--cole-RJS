# Auto-École Autonome — guide pour Claude

Site web et agents IA de l'Auto-École Autonome (248 rue de la République, 69400 Villefranche-sur-Saône).
Langue de travail : **français**. Le propriétaire n'est pas développeur : expliquer simplement, sans jargon.

## Structure
- `index.html`, `formations.html`, … : pages du site (Vite multi-pages). Les blocs communs sont dans `src/partials/` et inclus via `<!-- @include nom -->`.
- `src/css/main.css` : design inspiré d'Apple/Spotify (Inter, fonds noir/gris clair, cartes arrondies, rouge #e30613 en accent).
- `public/images/site/` : photos du site, branchées automatiquement par nom (voir `LISEZMOI.md` du dossier).
- `src/js/` : `hero3d.js` (voiture 3D en studio pilotée par le défilement), `quiz.js` (panneau 3D), `slider.js`, `chat.js` (widget du Copilote).
- `content/connaissances.md` : **source unique de vérité** des informations de l'auto-école (horaires, formations, financement…). L'agent Copilote répond à partir de ce fichier.
- `content/avis.json`, `content/quiz.json` : avis du livre d'or, questions du « panneau du jour ».
- `agents/faq/` : agent « Questions des élèves » (`/api/chat`, fonction Netlify `netlify/functions/chat.mjs`).
- `agents/planning/` : agent planning hebdomadaire (CSV ou iCal → annonces publiques + brief équipe + e-mails élèves).
- `agents/compta/` : agent comptabilité mensuelle (relevé bancaire CSV → rapport, journal, TVA estimée).
- `.github/workflows/` : exécutions automatiques (planning lundi + soirs, compta le 2 du mois, CI).

## Commandes
- `npm run dev` : site en local (http://localhost:5173), avec `/api/chat`.
- `npm test` : tests (doivent passer avant tout commit).
- `npm run build` : version de production dans `dist/`.
- `npm run agent:faq -- "question"`, `npm run agent:planning -- --mode recap --csv fichier.csv`, `npm run agent:compta -- --mois AAAA-MM --releve fichier.csv`.

## Règles
- Toute information pratique modifiée (horaire, tarif, équipe…) se met à jour **à la fois** dans `content/connaissances.md` et dans les pages HTML concernées (skill `mettre-a-jour-infos`).
- Ne jamais publier de nom d'élève ni de donnée personnelle sur le site : `public/data/annonces.json` est public.
- Les données privées (`data/prive/`, `etat/`, `sorties/`, `.env`) sont ignorées par git. Ne pas les commiter.
- Les montants comptables sont calculés par le code (`agents/compta/index.js`), jamais par le modèle.
- Modèle Claude par défaut : `claude-opus-5-5` (surchargeable avec `CLAUDE_MODEL`).
- Les skills de développement (Superpowers : brainstorming, plans, TDD, débogage, revue) sont dans `.claude/skills/` : les utiliser pour toute évolution du code.
