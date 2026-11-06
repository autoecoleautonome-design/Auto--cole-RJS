---
name: mettre-a-jour-infos
description: Met à jour une information pratique de l'auto-école (horaires, formation, tarif, équipe, coordonnées, financement, fermeture exceptionnelle) partout où elle apparaît : base de connaissances du Copilote et pages du site. À utiliser dès que le gérant annonce un changement d'information.
---

# Mettre à jour une information

1. Chercher toutes les occurrences de l'information : `grep -rn "<ancienne valeur>" content/ *.html src/partials/`.
2. Modifier `content/connaissances.md` (source de vérité de l'agent Copilote).
3. Modifier les pages HTML et `src/partials/footer.html` concernées (et le JSON-LD d'`index.html` pour les horaires).
4. Lancer `npm test` puis `npm run build`.
5. Résumer les fichiers modifiés et proposer de commiter et pousser : le site et le Copilote seront à jour après le déploiement.
