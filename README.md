# Auto-École Autonome : nouveau site et agents IA

Nouveau site de l'Auto-École Autonome (Villefranche-sur-Saône), qui reprend tout le contenu de l'ancien site
www.autoecoleautonome.fr, et trois agents IA (Claude) qui automatisent une partie du travail de l'agence.

| | Ce que ça fait | Quand |
|---|---|---|
| **Le Copilote** | Répond aux questions des élèves et des parents, 24h/24, dans une bulle de discussion sur le site | En continu |
| **Agent planning** | Récapitulatif de la semaine, annonces des changements sur le site, brief de l'équipe, e-mail personnel à chaque élève | Lundi 6h + chaque soir du mardi au samedi |
| **Agent comptable** | Classe les opérations du relevé bancaire, calcule CA, charges, résultat et TVA estimée, rédige une analyse | Le 2 de chaque mois |

## Le site

- **Style** inspiré des pages produit Apple et de Spotify : grande typographie (Inter / Inter Tight), fonds noirs et gris
  clair, cartes très arrondies, navigation en verre dépoli, boutons pilule, rouge de la voiture-école en couleur d'accent.
- **Animation 3D** (Three.js) : la voiture-école, enseigne « AUTO-ÉCOLE » sur le toit, tourne sur un plateau de studio ;
  le défilement de la page pilote la rotation et la caméra, avec trois messages qui apparaissent tour à tour.
- **Slides dynamiques** : rangée de formations en cartes colorées (façon Spotify), grille « bento » (façon Apple),
  parcours en onglets, avis en bandeau défilant sur deux rangées, galerie photos. Glisser à la souris ou au doigt, flèches, clavier.
- **Panneau du jour** : un panneau en 3D qu'on peut faire tourner, avec une question de code (11 panneaux).
- **Photos** : déposez vos images dans `public/images/site/` avec les noms indiqués dans
  `public/images/site/LISEZMOI.md` ; elles s'affichent automatiquement (portraits de l'équipe, voiture, salle de code).
- **Pages** : accueil, formations, code, financement (CPF, 1 €/jour), inscription, examen, planning, avis (84 avis du livre d'or),
  label qualité (13 documents PDF), contact (carte, formulaire), mentions légales, page 404.
- Accessible (clavier, lecteurs d'écran, animations réduites si demandé), adapté au mobile, référencement local (JSON-LD),
  redirections des anciennes adresses (`netlify.toml`).

Aperçu en local :

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir http://localhost:5173.

## Mise en ligne

### GitHub Pages (gratuit, déjà activé)
Le site doit être **construit** avant d'être publié : GitHub Pages ne doit donc pas publier les fichiers bruts de la branche.

1. Ouvrez *Settings → Pages* du dépôt : https://github.com/autoecoleautonome-design/Auto--cole-RJS/settings/pages
2. Dans *Build and deployment → Source*, choisissez **GitHub Actions** (au lieu de « Deploy from a branch »).
3. Onglet *Actions* → workflow « Site sur GitHub Pages » → *Run workflow*. Ensuite, chaque modification poussée est publiée automatiquement.

Adresse : https://autoecoleautonome-design.github.io/Auto--cole-RJS/ (ou votre domaine si vous en branchez un dans *Settings → Pages → Custom domain* ;
le chemin s'adapte tout seul).

Sur GitHub Pages, il n'y a pas de serveur : le Copilote répond alors en cherchant dans la base de connaissances
(`content/connaissances.md`), sans IA. Pour des réponses rédigées par Claude, hébergez en plus la fonction sur Netlify (ci-dessous),
puis dans *Settings → Secrets and variables → Actions → Variables*, ajoutez `VITE_CHAT_API` = `https://<votre-site>.netlify.app/api/chat`
et, sur Netlify, la variable `ALLOWED_ORIGINS` = `https://autoecoleautonome-design.github.io`.

### Netlify (site + IA au même endroit)
1. Sur [app.netlify.com](https://app.netlify.com) : *Add new site* → *Import an existing project* → GitHub → ce dépôt.
   Les réglages de build sont lus dans `netlify.toml`.
2. *Site configuration → Environment variables* : ajouter `ANTHROPIC_API_KEY` (clé créée sur [console.anthropic.com](https://console.anthropic.com)).
3. *Domain management* : brancher `autoecoleautonome.fr`. *Forms* : activer les notifications du formulaire « contact ».

## Les agents

### Le Copilote (questions des élèves)
- Code : `agents/faq/`. Il répond **uniquement** à partir de `content/connaissances.md` et des annonces de la semaine.
- Il n'invente ni tarif, ni date, ni horaire : sinon il renvoie vers le 04 74 62 38 62.
- Tester dans le terminal :

```bash
npm run agent:faq -- "Puis-je payer mon permis avec le CPF ?"
```

### Agent planning
- Source : l'agenda Google de l'agence (adresse secrète iCal) ou un export CSV.
  Convention dans Google Agenda : titre « Conduite - Prénom Nom », « Code en salle », « Examen - Prénom Nom », « Fermeture » ;
  dans la description, une ligne `email: …` et une ligne `moniteur: …`.
- Il compare avec le passage précédent, puis :
  1. publie sur le site (`public/data/annonces.json`) un résumé **sans aucun nom d'élève** ;
  2. rédige le brief de l'équipe (charge par enseignant, examens, annulations à recaser) ;
  3. prépare un e-mail personnel à chaque élève concerné (horaires insérés par le code, pas par l'IA).
- Essai avec les exemples fournis :

```bash
npm run agent:planning -- --mode recap --csv exemples/planning-v1.csv --date 2026-11-08
```

```bash
npm run agent:planning -- --mode changements --csv exemples/planning-v2.csv --date 2026-11-09
```

### Agent comptable
- Entrée : l'export CSV du relevé bancaire du mois.
- Classement par règles (URSSAF, CPF, carburant, loyer…), Claude pour les libellés inconnus ; les totaux sont **calculés par le code**.
- Sorties dans `sorties/compta/AAAA-MM/` : `rapport.md`, `journal.csv` (Excel), `synthese.json`. Comparaison avec le mois précédent.
- Outil de pilotage : à valider avec votre expert-comptable (taux de TVA et comptes par défaut dans `agents/compta/categories.js`).

```bash
npm run agent:compta -- --mois 2026-10 --releve exemples/releve-2026-10.csv
```

### Automatisation GitHub Actions
Dans *Settings → Secrets and variables → Actions* du dépôt, ajouter :

| Secret | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé Claude |
| `PLANNING_ICS_URL` | Adresse secrète iCal de l'agenda Google (*Paramètres de l'agenda → Adresse secrète au format iCal*) |
| `PLANNING_EQUIPE_EMAIL` | Destinataire du brief de l'équipe |
| `PLANNING_ETAT_CLE` | Mot de passe long et aléatoire : chiffre le planning gardé d'une semaine à l'autre (indispensable, le dépôt étant public) |
| `COMPTA_DESTINATAIRE` | Destinataire du rapport comptable |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envoi des e-mails (Gmail : `smtp.gmail.com`, `465`, mot de passe d'application) |

Les workflows planifiés ne tournent que sur la branche principale (`main`) : fusionnez ce travail dans `main` pour les activer.
Le dépôt étant **public**, aucune donnée d'élève n'est conservée en clair sur GitHub : l'état du planning est chiffré,
le brief et les e-mails sont seulement envoyés par e-mail. La comptabilité se lance **sur votre ordinateur** :
ne déposez jamais de relevé bancaire dans le dépôt (les fichiers `compta/releves/*.csv` sont ignorés par git).

## Claude Code : skills installés

Dans `.claude/skills/`, chargés automatiquement quand vous ouvrez ce dépôt avec Claude Code :

- **Métier (créés pour l'auto-école)** : `planning-semaine`, `compta-du-mois`, `mettre-a-jour-infos`, `repondre-aux-eleves`
  (brouillons de réponse dans Gmail à partir de la base de connaissances).
- **Superpowers** (ingénierie, licence MIT, [obra/superpowers](https://github.com/obra/superpowers)) : brainstorming, writing-plans,
  executing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting/receiving-code-review,
  subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, writing-skills…
- **Anthropic** (licence Apache 2.0, [anthropics/skills](https://github.com/anthropics/skills)) : frontend-design, webapp-testing,
  mcp-builder, skill-creator, claude-api, theme-factory, internal-comms, web-artifacts-builder.
- Les skills Word, Excel, PowerPoint et PDF d'Anthropic ne sont pas redistribuables : ils sont déjà intégrés à Claude
  (claude.ai et Claude Code). Pour recevoir les mises à jour de Superpowers, vous pouvez aussi l'installer en plugin :
  `/plugin marketplace add obra/superpowers-marketplace` puis `/plugin install superpowers@superpowers-marketplace`.

Exemples de demandes à Claude Code : « fais la compta d'octobre avec ce relevé », « prépare le planning de la semaine »,
« l'agence sera fermée le 24 décembre, mets le site à jour », « réponds aux mails des élèves ».

## À vérifier avant la mise en ligne

- **Horaires du bureau** : l'ancien site affichait trois versions différentes. J'ai retenu celle du document officiel
  « Modalités d'organisation 2025 » (mardi 15h–19h, mercredi à vendredi 14h–19h). À confirmer.
- **SIRET** : l'ancien site affiche « 841914195000148 » (15 chiffres, un de trop). Seul le SIREN 841 914 195 est publié.
- **Tarifs** : absents de l'ancien site ; le site et le Copilote indiquent « sur devis ».
- **Photos** : seules les photos propres à l'auto-école ont été reprises (agence, voiture, salle de code, affiches).
  Les images génériques du prestataire ORATA, protégées par ses droits, n'ont pas été copiées. Des photos de l'équipe
  remplaceraient avantageusement les initiales.
- **Mentions légales** : indiquer l'hébergeur définitif.

## Développement

```bash
npm test
```

```bash
npm run build
```

Structure détaillée et règles : voir `CLAUDE.md`.
