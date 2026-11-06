---
name: compta-du-mois
description: Fait la comptabilité du mois de l'auto-école à partir du relevé bancaire (classement des opérations, chiffre d'affaires, charges, TVA estimée, rapport). À utiliser quand le gérant demande la compta, le bilan du mois, la TVA, ou dépose un relevé bancaire.
---

# Comptabilité du mois

1. Obtenir le relevé bancaire CSV du mois (export de la banque). Le placer dans `data/prive/` (ignoré par git) sauf si l'utilisateur veut l'archiver dans `compta/releves/AAAA-MM.csv` (dépôt privé).
2. Lancer : `node agents/compta/cli.js --mois AAAA-MM --releve <fichier>`.
3. Lire `sorties/compta/AAAA-MM/rapport.md` et présenter : chiffre d'affaires HT, charges, résultat estimé, TVA nette estimée, trésorerie, et la liste « Opérations à vérifier ».
4. Pour chaque opération à vérifier, demander à l'utilisateur la bonne catégorie. Si un libellé revient chaque mois, ajouter une règle dans `agents/compta/categories.js` (tableau `RULES`), puis relancer `npm test`.
5. Rappeler que le rapport est un outil de pilotage à valider avec l'expert-comptable ; ne jamais affirmer un montant de TVA « définitif ».
6. Ne jamais calculer soi-même les totaux : utiliser ceux du rapport.
