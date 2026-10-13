# Logistécole — Sous-projet 1 : socle

Date : 2026-10-13
Statut : spec à relire par JF avant rédaction du plan

## 1. Contexte et intention

Hector Asset Manager (hectorassetmanager.com) facture la gestion de matériel 39,99 EUR/mois (Bouclier, 0 à 250 actifs), 76,99 EUR/mois (Armure : prêts, QR codes, stock minimum, signature), 151,99 EUR/mois (Château). Prix lus sur la page tarifs, palier le plus bas, par palier d'actifs.

Intention de JF : une alternative gratuite pour les écoles, pas un clone. Les écoles manquent d'argent : aucune option payante ne leur est proposée.

Usages visés (cas C) :
- Matériel d'une école : tablettes, ordinateurs, projecteurs, matériel de sciences ou de sport.
- Matériel du Pôle (PLAI), prêté à des écoles ou enseignants.

Échelle : v1 = pilote (le Pôle + 5 à 10 écoles) sur l'offre gratuite Supabase ; v2 = toutes les écoles du Pôle de Liège (quelques dizaines), plan payant éventuel à décider à ce moment. La v1 ne doit pas interdire la v2.

Entrée des organisations : sur invitation par JF en v1, modèle de données prêt pour l'inscription libre-service en v2.

Nom : Logistécole. Préfixe de tables `logi_`. Sous-domaine `logistecole.jfb4plai.com`. Pas de suffixe « -Actif ». Charte graphique validée par JF : attrayante, avec des couleurs proches du logo PLAI (teal #0f6e56, orange #f97316, DM Sans / DM Serif Display, base `shared/css/plai-style.css`), moins institutionnelle que les apps pédagogiques. Tâche nav / conteneur / footer et vérification visuelle à prévoir explicitement dans le plan.

## 2. Décomposition en sous-projets

Chaque sous-projet a sa spec, son plan et son déploiement. Ordre :

1. **Socle** (cette spec) : organisations, comptes et rôles, objets, emplacements, catégories, historique, étiquettes QR.
2. Prêts et scan : prêt et retour en deux scans, prêt à des tiers (enseignant, code élève, autre organisation).
3. Import Excel.
4. Réservations par créneau (comptes enseignants à ce stade).
5. Pannes et maintenance.
6. Consommables et stock minimum.

Hors périmètre définitif : comptabilité, amortissement, SSO, intégrations IT, portes connectées, RFID, application native.

## 3. Décisions d'architecture

- **Organisations à plat** (approche 1). Une table d'organisations avec un type `pole` ou `ecole`. Chaque objet appartient à une seule organisation. Pas de hiérarchie Pôle -> écoles, pas de visibilité héritée. Un partage opt-in par école pourra s'ajouter plus tard sans refonte.
- Un prêt du Pôle à une école est une ligne dans le registre du Pôle, avec une fiche emprunteur de type `organisation` (sous-projet 2).
- **Emprunteurs sans compte en v1.** Seuls les gestionnaires ont un compte. L'emprunteur est une fiche (enseignant par initiales, élève par code anonyme, ou organisation). Un champ `compte_id` optionnel lie plus tard une fiche à un compte enseignant (sous-projet 4) sans migration douloureuse.
- **Stack** : React 18 + Vite 5 + Tailwind v3, Supabase v2 (projet partagé dfoaumjleqtxjeaplnna), Vercel, GitHub jfb4plai branche `main`. Application web installable (PWA), sans application native. Pas d'IA dans ce sous-projet.
- Scan par la caméra du navigateur avec une bibliothèque libre. Le QR contient l'adresse de la fiche de l'objet.
- Étiquettes : PDF généré dans le navigateur, planches de QR avec nom, code court et nom de l'organisation propriétaire en petit.
- Photos : compressées dans le navigateur avant envoi, bucket Supabase privé, accès isolé derrière une seule couche de code pour permettre une migration de stockage en v2.

## 4. Modèle de données

Toutes les tables sont préfixées `logi_`. Vérifier avant chaque `create table` : `grep -rIn "create table" --include=*.sql --exclude-dir=node_modules .` depuis la racine du workspace (préfixe `logi_` libre au 2026-10-13). Ne pas recréer `profiles` ni le trigger `updated_at`. Grants Data API dans la même migration que chaque `create table`.

**Organisations et accès**
- `logi_organisations` : id, nom, type (`pole` | `ecole`), statut, dates.
- `logi_membres` : compte (auth.uid via profiles), organisation, rôle (`admin` | `gestionnaire` | `lecture`). Un compte peut appartenir à plusieurs organisations.

**Inventaire**
- `logi_emplacements` : arborescence simple (bâtiment, local, armoire), par organisation, parent optionnel.
- `logi_categories` : par organisation, créées à partir d'une liste de départ modifiable.
- `logi_objets` : organisation, nom, catégorie, emplacement, état (`bon` | `use` | `defectueux` | `perdu` | `sorti`), photo (chemin de stockage), notes, **code court unique** (contrainte d'unicité en base) servant d'identifiant dans le QR, dates.
- `logi_historique` : objet, organisation, auteur (compte), horodatage serveur, type d'événement (création, déplacement, changement d'état, correction, et plus tard prêt et retour), valeur avant, valeur après, commentaire.

**Emprunteurs (table créée au socle, logique au sous-projet 2)**
- `logi_emprunteurs` : organisation, type (`enseignant` | `eleve` | `organisation`), libellé (initiales ou code anonyme, jamais de nom d'élève), organisation liée optionnelle, `compte_id` optionnel.

**Isolation**
- Un membre ne voit et n'écrit que les données de ses organisations. Le Pôle ne voit pas les inventaires des écoles, et inversement.

**Historique en écriture seule**
- Les gestionnaires et administrateurs ont `insert` et `select` sur `logi_historique`, jamais `update` ni `delete`, y compris l'administrateur. Verrouillé par RLS et grants, pas seulement par l'interface.
- Une erreur de saisie se corrige par une nouvelle ligne de type `correction`, l'ancienne reste visible.
- L'état actuel (emplacement, état) est dans `logi_objets` ; l'historique explique comment on y est arrivé.
- Un objet n'est pas supprimé en usage normal : il passe à l'état `sorti` (don, rebut), ce qui conserve son historique. Une suppression définitive reste possible pour l'administrateur, avec confirmation explicite.

## 5. Écrans et parcours

Mobile d'abord, texte 16 px minimum, contraste suffisant, une action principale par écran, état jamais signalé par la couleur seule (pastille + mot).

1. **Connexion** par e-mail. Sélecteur d'organisation si plusieurs appartenances. Un administrateur invite les gestionnaires par e-mail.
2. **Accueil = liste du matériel** : recherche, filtres (catégorie, emplacement, état), gros bouton Scanner.
3. **Scan** : caméra, QR reconnu -> fiche. QR d'une autre organisation ou inconnu : message clair. Caméra refusée ou absente : saisie manuelle du code court.
4. **Fiche objet** : photo, nom, catégorie, emplacement, état, notes, historique du plus récent au plus ancien. Actions : modifier, déplacer, changer l'état, imprimer l'étiquette. Prêt et retour au sous-projet 2.
5. **Création / modification** : champs guidés (label précis, placeholder concret avec exemple FWB comme « Valise de 16 tablettes, salle 12 », aide sous le champ expliquant la portée). Seuls le nom et la catégorie sont obligatoires. Création en lot (par exemple 16 objets identiques, chacun avec son code), plafonnée à 100 par opération, en une transaction.
6. **Étiquettes** : sélection d'objets, planche PDF de QR (nom, code court, nom de l'organisation en petit), pour imprimante de bureau.
7. **Administration** (admin) : emplacements, catégories, membres. Import Excel au sous-projet 3.

Un encart sur l'accueil indique ce qui n'existe pas encore (prêts, réservations, notifications) pour ne pas laisser croire à des fonctions absentes.

## 6. Sécurité

- RLS sur toutes les tables `logi_`. Politiques via fonctions `security definer` (`logi_est_membre(org_id)`, `logi_a_role(org_id, role)`), jamais d'EXISTS auto-joint sur la même table (incident AménagActif 2026-09-23).
- Grants : `anon` aucun accès ; `authenticated` selon le rôle ; `logi_historique` sans `update` ni `delete`.
- Bucket photos privé, chemins préfixés par l'identifiant de l'organisation, politiques de stockage basées sur les mêmes fonctions.
- Aucune clé dans le frontend hors clé publique Supabase. Aucun `console.log` de données utilisateur.
- Données personnelles : pas de noms d'élèves. Seules données nominatives : e-mails des gestionnaires.
- Le QR n'ouvre rien sans connexion.
- Plafonds : invitations et création en lot.

## 7. Gestion des erreurs

- Chaque écran : état vide expliqué, chargement, erreur lisible en français sans code technique.
- Pas de mode hors ligne en v1 : message clair, aucune écriture partielle.
- Création en lot transactionnelle.
- Unicité du code court garantie en base.

## 8. Tests et vérification

- **Tests base de données** (prioritaires), avec deux organisations de test, en transaction annulée : isolation entre A et B en lecture, écriture et suppression ; rôle `lecture` sans écriture ; `logi_historique` refuse `update` et `delete` même pour un admin.
- Tests unitaires : génération des codes courts, compression des photos, mise en page des planches.
- Parcours complet en navigateur avant livraison, en lisant les valeurs (pas seulement l'apparence) : connexion, création, scan d'un vrai QR, planche, modification, historique.
- `npx vite build` sans erreur avant tout `git push`.
- Recette sur de vrais téléphones, avec chemins Windows absolus et URL exactes fournis à JF.
- Test de génération IA : sans objet (pas d'IA).
- Références scientifiques : aucune dans ce sous-projet, pas de vérification RISS requise.

## 9. Points ouverts

- Charte graphique : tranchée (attrayante, couleurs proches du logo PLAI). Reste à concevoir le rendu concret, à valider visuellement en cours de construction.
- Liste de départ des catégories à rédiger avec exemples FWB.
- Disponibilité du nom et du sous-domaine non vérifiée.
- Coût de stockage des photos à surveiller (seuil de compression, par exemple 200 Ko).
- Mode hors ligne : hors périmètre, à reconsidérer si les écoles l'exigent.
- Plan payant Supabase éventuel pour la v2 : décision et financement à trancher avant le passage à l'échelle.

## 10. Limites à dire clairement aux utilisateurs

Pas de prêt, réservation, notification ni accès emprunteur dans ce sous-projet ; pas de mode hors ligne ; pas d'application native ; pas de RFID ni de comptabilité.
