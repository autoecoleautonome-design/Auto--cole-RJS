# Relevés bancaires

Déposez ici l'export CSV de votre banque, un fichier par mois, nommé `AAAA-MM.csv` (ex. `2026-10.csv`).

- Colonnes reconnues : `Date`, `Libellé`, et soit `Montant` (négatif = dépense), soit `Débit` / `Crédit`.
- Séparateur `;` ou `,`, montants « 1 234,56 » acceptés.
- ⚠️ Ce dépôt doit rester **privé** : ces fichiers contiennent vos données bancaires.
- Pour ne rien stocker sur GitHub, lancez plutôt l'agent sur votre ordinateur :
  `npm run agent:compta -- --mois 2026-10 --releve chemin/vers/export.csv`
