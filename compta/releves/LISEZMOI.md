# Relevés bancaires

⚠️ **Ce dépôt est public : n'y déposez jamais de relevé bancaire.** Les fichiers `.csv` de ce dossier
sont ignorés par git par sécurité.

Lancez la comptabilité sur votre ordinateur :

```bash
npm run agent:compta -- --mois 2026-10 --releve chemin/vers/export.csv
```

- Colonnes reconnues : `Date`, `Libellé`, et soit `Montant` (négatif = dépense), soit `Débit` / `Crédit`.
- Séparateur `;` ou `,`, montants « 1 234,56 » acceptés.
- Le rapport est écrit dans `sorties/compta/AAAA-MM/` (lui aussi ignoré par git).
- Le workflow automatique « Agent comptabilité » ne fonctionne que si le dépôt redevient privé.
