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

## Prélèvements mémorisés et crédits

La section **« Mes prélèvements et crédits »** garde les libellés et les montants :

- **Ajouter** un prélèvement (libellé, montant, premier prélèvement, durée facultative) : il est reconduit automatiquement chaque mois (5 ans glissants) tant que tu ne le retires pas.
- **Rendre récurrent** : le bouton 🔁 d'un prélèvement déjà saisi le mémorise et crée les mois suivants (l'historique passé n'est pas recréé).
- **Modifier le montant** (✎) : seules les échéances à venir changent. **Retirer** (🗑) : les échéances à venir sont supprimées, l'historique est conservé.
- Les libellés déjà utilisés sont proposés à la saisie.

**Crédits** : à la lecture d'un contrat ou d'un tableau d'amortissement, l'app retient la mensualité, le capital restant dû, le taux et le nombre d'échéances. Chaque crédit affiche son **reste à rembourser** (somme des échéances à venir) et son **capital restant dû**, qui diminuent à chaque échéance ; chaque ligne du mois indique le reste à rembourser après le paiement. Si le PDF ne donne pas le capital mois par mois, il est estimé à partir du taux (ou déduit du capital, de la mensualité et de la durée).

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

## Nouveautés de la version 1.2

- **Plus de limite à un an** : les récurrents sont planifiés **5 ans à l'avance** (et la fenêtre se prolonge toute seule), la navigation par mois n'a pas de limite, et l'équilibre du compte peut couvrir 2, 3 ou 5 ans.
- **Vue de l'année** : revenus, sorties et solde de fin de chaque mois, totaux de l'année ; un clic ouvre le mois.
- **Catégories** : champ facultatif à l'ajout et à la modification d'une ligne, avec la répartition des dépenses du mois en barres.
- **Export CSV** pour Excel / LibreOffice, en plus de l'export JSON.
- **Import plus sûr** : confirmation avant de remplacer les données, bouton « Annuler » juste après.
- **Copie de sécurité** : à la première ouverture de cette version, vos données sont copiées telles quelles (clé `budget-app-v1-avant-maj`) ; le bouton « Copie d'avant la mise à jour » les exporte. Le format de stockage n'a pas changé : vos données existantes sont conservées, seules des échéances futures sont ajoutées aux récurrents.
- Raccourcis ← / → pour changer de mois.

## Devises (version 1.3)

Le budget reste **en euros**. Pour une dépense ou un revenu dans une autre monnaie (voyage, achat en ligne…), choisissez la **devise** sous le montant (USD, GBP, THB… ou n'importe quel code à 3 lettres), saisissez le montant dans cette devise et le **taux** (« 1 € = ? devise ») : la ligne est convertie en euros, et la ligne affiche le montant d'origine et le taux. Le dernier taux de chaque devise est mémorisé. Modifier une ligne (✎) permet de corriger le montant d'origine ou le taux ; l'export CSV ajoute le montant et la devise d'origine. Les lignes existantes, toutes en euros, ne changent pas.

## Tests

```bash
npm install
npm test        # jsdom : vérifie notamment que les données existantes ne sont jamais modifiées
```

## Optimisations

- Prélèvements/dépenses récurrents : durée en mois facultative (jusqu'à 480 mois, fin de mois gérée : 31 janvier → 28 février)
- Application installable et utilisable **hors-ligne** (PWA : `manifest.webmanifest` + `sw.js`)
- Politique de sécurité (CSP) stricte : aucune requête externe possible
- Index par mois recalculé une seule fois par modification : le report ne reparcourt plus toutes les lignes à chaque affichage
- Application en un fichier, zéro dépendance, aucun framework
- Un seul écouteur d'événements pour toute la liste (délégation)
- Sauvegarde différée (une écriture `localStorage` par rafale d'actions)
- Échappement HTML systématique, montants arrondis au centime

## Utilisation simplifiée

- En haut : le **solde actuel de ton compte** (✎ pour saisir celui de ta banque) ; le reste du mois (revenus, dépenses, prélèvements à venir, prévu fin de mois) en dessous.
- Ajout en 3 champs : Dépense / Revenu / Prélèvement + libellé + montant + date ; « 🔁 Chaque mois » pour un salaire ou un prélèvement récurrent.
- Récurrents, crédits, import PDF et sauvegarde sont repliés dans « Plus d'options ».
- **Modifier les dates et le nombre** : ✎ sur un récurrent (Plus d'options) change le montant, la prochaine date de prélèvement et le nombre de prélèvements restants (vide = sans fin) ; ✎ sur une ligne de la liste déplace ou corrige une seule échéance.
- **Équilibre du compte** : l'outil ⚖️ simule jour par jour les revenus, dépenses et prélèvements à venir (jusqu'à fin de mois, 3, 6, 12 mois, 2, 3 ou 5 ans) et indique la somme à ajouter pour ne jamais passer sous une marge choisie, avec la date limite et un versement régulier équivalent.

## Améliorations d'efficacité

- **Alerte en haut** quand il manquera de l'argent (date et montant), et **courbe du solde prévu** avec le point bas dans l'outil d'équilibre.
- **Annuler** après une suppression (ligne ou récurrent), **recherche** sans accent, libellés modifiables.
- **Paiement automatique** : un prélèvement dont la date est passée est marqué payé (désactivable ; vos corrections manuelles sont respectées).
- **Données protégées** : écriture sécurisée (message si le stockage est bloqué), demande de stockage persistant, rappel de sauvegarde.
