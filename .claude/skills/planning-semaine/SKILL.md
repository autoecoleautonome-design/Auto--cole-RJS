---
name: planning-semaine
description: Prépare le récapitulatif du planning de la semaine de l'auto-école et annonce les changements (annonces du site, brief de l'équipe, e-mails aux élèves). À utiliser quand le gérant demande le planning de la semaine, les changements, les annulations ou un message aux élèves sur leurs leçons.
---

# Planning de la semaine

1. Trouver la source du planning :
   - un CSV fourni par l'utilisateur (colonnes : `id;date;debut;fin;type;titre;eleve;email;moniteur;statut;note`, voir `exemples/planning-v1.csv`) ;
   - sinon la variable `PLANNING_ICS_URL` (agenda Google au format iCal) ;
   - si le connecteur Google Agenda est disponible et qu'aucun fichier n'est fourni, lire les événements de la semaine avec lui et les écrire dans `data/prive/planning-AAAA-MM-JJ.csv` au format ci-dessus.
2. Lancer l'agent :
   - récapitulatif complet : `node agents/planning/cli.js --mode recap --csv <fichier>`
   - changements seulement : `node agents/planning/cli.js --mode changements --csv <fichier>`
   - ajouter `--envoyer` **uniquement** si l'utilisateur confirme l'envoi des e-mails.
3. Montrer à l'utilisateur : le résumé public (`public/data/annonces.json`), le brief équipe (`sorties/planning/<semaine>/…/brief-equipe.md`) et la liste des e-mails préparés.
4. Vérifier qu'aucun nom d'élève n'apparaît dans `public/data/annonces.json` avant de le commiter.
5. Proposer de commiter `public/data/annonces.json` pour mettre le site à jour.
