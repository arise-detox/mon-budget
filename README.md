# 💶 Mon Budget

Petite application web pour suivre ses **dépenses**, ses **prélèvements à venir** et ses **revenus**, avec les totaux du mois et un **report automatique du solde** sur le mois suivant.

## Fonctionnalités

- Ajout de dépenses, prélèvements à venir (à marquer « payé » le moment venu) et revenus
- Totaux du mois : revenus, dépenses, prélèvements à venir, solde actuel, solde prévisionnel
- **Report automatique** : le solde prévisionnel de fin de mois devient le « report » du mois suivant
- Solde de départ réglable, répartition des dépenses par catégorie
- Export / import JSON pour sauvegarder ses données (par exemple dans ce dépôt, en dehors du dossier public)
- Thème clair/sombre automatique, utilisable sur mobile

## Utilisation

Ouvrir `index.html` dans un navigateur. Aucune installation, aucune dépendance.
Les données restent dans le `localStorage` de ton navigateur (rien n'est envoyé sur internet).

## Publier sur GitHub Pages

Le workflow `.github/workflows/pages.yml` déploie l'app à chaque push sur `main`.
Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.

> ⚠️ Ne commite jamais tes fichiers d'export `budget-*.json` dans un dépôt public : ce sont tes données financières (ils sont ignorés par `.gitignore`).

## Optimisations

- Prélèvements/dépenses récurrents : champ « Répéter (mois) » (jusqu'à 60 mois, fin de mois gérée : 31 janvier → 28 février)
- Application installable et utilisable **hors-ligne** (PWA : `manifest.webmanifest` + `sw.js`)
- Politique de sécurité (CSP) stricte : aucune requête externe possible
- Index par mois recalculé une seule fois par modification : le report ne reparcourt plus toutes les lignes à chaque affichage
- Application en un fichier, zéro dépendance, aucun framework
- Un seul écouteur d'événements pour toute la liste (délégation)
- Sauvegarde différée (une écriture `localStorage` par rafale d'actions)
- Échappement HTML systématique, montants arrondis au centime
