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

Ouvrir `index.html` dans un navigateur suffit pour la saisie manuelle. Aucune installation.
Les données restent dans le `localStorage` de ton navigateur (rien n'est envoyé sur internet).

## Import de PDF (relevé bancaire, crédit en cours)

Le PDF est lu **localement dans le navigateur** (bibliothèque pdf.js, hébergée avec l'app) : il n'est jamais envoyé sur internet.

- **Relevé bancaire** : les opérations (date, libellé, montant) sont détectées, tu corriges le type (dépense / revenu), décoches ce que tu ne veux pas, puis importes. Les doublons sont décochés automatiquement. Règle ensuite le « solde de départ » (solde du compte avant la 1ʳᵉ opération du relevé).
- **Crédit en cours** : un tableau d'amortissement ou une offre de prêt est analysé (mensualité, mois restants, échéances à venir). Les échéances deviennent des prélèvements à venir ; sinon, renseigne mensualité / mois restants / prochaine échéance et clique sur « Générer ».
- Limites : il faut un PDF « texte » téléchargé depuis ta banque (un scan/photo ne marche pas), et la reconnaissance est heuristique : vérifie toujours le tableau avant d'importer.

L'import PDF nécessite que l'app soit servie en http(s) (GitHub Pages, ou en local) :

```bash
npm install
npm start        # copie pdf.js dans vendor/ puis sert l'app sur http://localhost:8080
```

Sur GitHub Pages, le workflow installe pdf.js (version figée dans `package.json`) automatiquement.

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
