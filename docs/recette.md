# Recette de Logistécole (état du 2026-11-03)

Dossier du projet : `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole`
Dépôt : https://github.com/jfb4plai/Logistecole (branche `main`)
Adresse prévue : https://logistecole.jfb4plai.com (pas encore en ligne)

## 1. Ce qui est vérifié, ce qui ne l'est pas

| Élément | Statut | Preuve |
|---|---|---|
| SQL (socle, prêts, kits, réservations, stock, pannes, achat) et droits | Constaté sur un vrai Postgres local (PGlite), pas sur la base de JF | `npx vitest run tests/sql` : 9 tests, dont 6 mutations volontaires toutes détectées ; droits d'exécution et de colonnes vérifiés par requête |
| Règles métier côté application (échéances, kits, liens, import, créneaux, NFC, invitations) | Constaté | `npx vitest run` : 170 tests |
| Affichage des pages et règles par rôle | Constaté avec des données simulées | `tests/pages/pages.test.jsx` (28) ; mode démo : 11 pages mesurées (texte 16 px, cibles 44 px, pas de débordement) |
| Lecture d'un vrai fichier .xlsx | Constaté (fichier généré, cellule de date comprise) | essai du 2026-11-03 |
| Base de JF avec la migration complète | Non vérifié | script `supabase\tests\...` à exécuter |
| Connexion par lien e-mail, invitation réelle | Non vérifié | demande l'accord de JF (e-mail réel) |
| Scan caméra, QR imprimé lu par un téléphone | Non vérifié (QR lu par une bibliothèque en test, pas par un téléphone) | essai téléphone |
| Écriture et lecture NFC | Non vérifié | Android + iPhone |
| Photos (envoi, compression ~200 Ko, stockage privé) | Non vérifié | dépend du bucket en base |
| Déploiement Vercel | Non fait | |

## 2. Mettre la base à jour (JF ou Claude avec accord, via le SQL Editor ou `supabase db query --yes`)

Dans cet ordre, un fichier à la fois (ouvrir, tout copier, coller, Run) :

1. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\migrations\20261013b_logistecole_droits.sql` : retire les droits par défaut de Supabase (si ce n'est pas déjà fait). Attendu : `Success. No rows returned`.
2. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\migrations\20261014_logistecole_prets.sql` : prêts, kits, réservations, stock, pannes, achat, rôle enseignant. Attendu : `Success. No rows returned`.
3. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\tests\logistecole_rls.sql` : attendu `LOGISTECOLE RLS : tous les tests passent` (se termine par un `rollback`).
4. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\tests\logistecole_prets.sql` : attendu `LOGISTECOLE PRETS : tous les tests passent` (idem).
5. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\seed-organisation-essai.sql` : crée « Pôle PLAI (essai) » avec `jeanfrancois.beguin@ens.ecl.be` comme administrateur.

Si une des étapes 3 ou 4 affiche une erreur, copier le message : il indique la règle qui échoue.

## 3. Essayer sans base : mode démonstration

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && npm run demo
```
Ouvrir http://localhost:5181 . Rien n'est enregistré (données en mémoire). Changer de rôle : ajouter `?role=emprunteur`, `?role=gestionnaire`, `?role=lecture` ou `?role=admin` à l'adresse (ex. http://localhost:5181/?role=emprunteur).

## 4. Essai avec la vraie base (après la section 2)

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/logistecole && vercel dev
```
(`vercel dev` et non `npm run dev` : seul `vercel dev` fait tourner `/api/inviter`.) Les Redirect URLs de Supabase doivent contenir l'adresse locale utilisée.

## 5. Parcours à faire sur téléphone (cocher ce qui est confirmé)

Avec deux comptes : un administrateur, un enseignant (rôle « Enseignant »).

1. Administration > Importer > télécharger le modèle CSV, le remplir de 3 lignes, l'importer. Attendu : « N objets importés ».
2. Ajouter un kit : un objet « Valise de tablettes » ; puis 3 objets « Tablette » avec « Fait partie du kit » = la valise ; remplir un achat (date, prix, garantie) et un lien utile.
3. Étiquettes : imprimer la planche (PDF dans `C:\Users\jfbeg\Downloads\etiquettes-logistecole.pdf`), poser le QR sur la valise.
4. Enseignant : scanner le QR de la valise, « Emprunter pour moi ». Attendu : « Prêté à… » et la date de retour ; « Mes emprunts » montre le kit.
5. Enseignant : décocher une tablette, « Enregistrer le retour ». Attendu : la valise est rendue, la tablette reste prêtée, la fiche du kit note « Il manque ».
6. Gestionnaire : rendre la tablette restante en « Défectueux ». Attendu : l'objet devient défectueux, il apparaît dans Suivi > À réparer.
7. Gestionnaire : « Marquer réparé ». Attendu : retour à « Bon état ».
8. Réserver un projecteur pour demain 10 h-12 h avec l'enseignant ; essayer 11 h-13 h avec un autre compte. Attendu : refus « déjà réservé ».
9. Consommable « Piles AA » (stock 4, seuil 6) : l'accueil signale « à racheter » ; mouvement -3 ; essayer -10 : refus « Stock insuffisant ».
10. Administration > Membres : coller 3 adresses, rôle Enseignant, « Inviter ». Attendu : rapport par adresse (e-mails réels : accord de JF).
11. Android Chrome : sur une fiche, « Écrire la puce » ; puis toucher la puce avec le téléphone d'un autre appareil : la fiche s'ouvre. iPhone XS ou plus récent : toucher la même puce : une notification apparaît, à toucher.
12. Isolation : un compte de l'organisation A ne voit rien de l'organisation B.

## 5 bis. Fiche enrichie : critères « Pour qui ? », type, ISBN (migration 20261019)

Prérequis : migration `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\migrations\20261019_logistecole_fiche_enrichie.sql` appliquée sur la base (accord de JF). Sans elle, la liste du matériel ne se charge plus. Application : `npm run dev` dans `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole`, puis `http://localhost:5180/` (vraie base). Pour un essai sans base : `npm run demo` puis `http://localhost:5181/?role=admin` (aucune donnée enregistrée).

1. Ajouter un livre : nom « Les neurones de la lecture », ISBN `2-7381-1974-3`, auteur, éditeur. Attendu : la fiche montre l'ISBN `9782738119742`.
2. ISBN `123`. Attendu : « L'ISBN n'est pas valide… » et rien n'est créé.
3. « Pour qui ? » : cocher Dyslexie, la difficulté Lecture, le chapitre « 5. LECTURE » en entier, et deux aménagements précis d'un autre chapitre. Attendu : la fiche les affiche ; le chapitre entier grise ses détails ; la mention « Étiquettes indicatives posées par l'équipe, pas une prescription. » est visible.
4. « Autre (préciser) » coché sans texte, puis Ajouter. Attendu : refus qui nomme la liste. Taper un texte puis décocher la case : rien n'est enregistré.
5. Accueil : Filtres > Troubles > Dyslexie. Attendu : seuls les objets étiquetés Dyslexie. Ajouter la difficulté Calcul : ET entre familles, la liste se réduit. Cocher un chapitre entier : trouve aussi les objets liés à un aménagement précis de ce chapitre.
6. Accueil : chercher `978-2-7381-1974-2`, puis le nom de l'auteur. Attendu : le livre apparaît.
7. Objet numérique : type « Numérique », lien d'accès dans « Liens utiles ». Attendu : pas de champ quantité, pas de consommable ni de kit, pas de bouton de prêt ni d'étiquette ; l'accueil affiche « Numérique ».
8. Dans AménagActif, désactiver un aménagement déjà lié à une fiche, rouvrir la fiche. Attendu : il reste affiché « désactivé dans AménagActif » et n'est plus proposé sur les autres fiches. Le réactiver ensuite.
9. Couper le réseau, ouvrir « Modifier la fiche », enregistrer sans toucher aux critères. Attendu : message « Les listes n'ont pas pu être chargées » et aucun critère n'est effacé (vérifier après retour du réseau).
10. Compte enseignant : la fiche montre les critères, aucun lien « Modifier la fiche ». Administration > « Textes « Autre » » : les textes saisis, par famille, avec lien vers la fiche.
11. Téléphone : les listes à cocher s'ouvrent sur toute la largeur, chaque case se touche sans erreur (44 px), le texte reste lisible. Jamais essayé à ce jour.
12. Import : CSV avec colonnes `auteur;éditeur;isbn;description;support`, une ligne à ISBN faux. Attendu : cette ligne est refusée avec son numéro, les autres s'importent.

## 5 ter. Mot de passe et connexion dans plusieurs onglets

Application : `http://localhost:5180/` (vraie base). Ne pas oublier : le compte est commun à toutes les apps du projet Supabase.

1. Connecté par lien e-mail en administrateur : menu **Mon compte**, choisir un mot de passe de 12 caractères ou plus (phrase courte), le confirmer. Attendu : « Mot de passe enregistré ». Un mot de passe de 11 caractères est refusé avant tout envoi.
2. **Déconnexion**, puis page de connexion > onglet **Avec mon mot de passe** : adresse + mot de passe. Attendu : arrivée directe sur « Matériel », sans e-mail.
3. Mot de passe faux. Attendu : « Adresse ou mot de passe incorrect… », sans dire lequel des deux est faux.
4. Compte enseignant (jf.beguin@outlook.com) : pas de lien « Mon compte » dans le menu.
5. Deux onglets Edge ouverts sur `http://localhost:5180/`, connectés. Se déconnecter dans l'onglet 1. Attendu : l'onglet 2 revient seul sur la page de connexion, sans recharger.
6. Dans l'onglet 1, se reconnecter. Attendu : l'onglet 2 (resté sur la connexion) arrive seul sur « Matériel ».
7. Se déconnecter, se reconnecter avec un AUTRE compte (enseignant). Attendu : aucune donnée de l'administrateur n'apparaît dans aucun onglet (le cache est vidé).
8. Le choix « mot de passe » ou « lien » est retenu à la visite suivante.

## 6. Limites connues

- Revue finale : le relecteur indépendant n'a pas pu s'exécuter (limite de crédits), la revue a été faite par l'auteur lui-même, ce qui est plus faible. Elle a produit 8 corrections (droits des fonctions de déclencheur, colonne `compte_id` protégée, verrou prêt/réservation, API d'invitation sans fuite d'existence de compte et `SITE_URL` obligatoire, taille et format du fichier d'import, heure belge dans l'historique, prêts ouverts seulement sur la fiche, pagination au-delà de 1000 lignes, élément de kit non rendu visible dans Suivi).
- Le verrou entre prêt et réservation (deux demandes simultanées) n'a pas de test : une course ne se reproduit pas de façon déterministe dans une seule connexion.
- Un enseignant peut techniquement lire le prix, le fournisseur et le lien de facture d'un objet : la base filtre par organisation, pas par colonne, et l'interface les montre à tous les membres. Les masquer aux enseignants demanderait de déplacer ces champs dans une table réservée aux gestionnaires. À décider par JF.
- L'échéance est contrôlée côté base avec la date UTC : entre 0 h et 2 h (heure belge), l'écart d'un jour est possible sur les bornes (aujourd'hui, +365 jours).
- Un enseignant qui rend un prêt peut déclarer un état « perdu » ou « défectueux », qui change l'état de l'objet ; l'action est tracée et un gestionnaire peut la corriger.

- Pas de rappel de retour par e-mail ; pas de mode hors ligne ; pas de comptabilité.
- Le prix d'une puce NFC (moins d'1 euro) vient de JF et n'est pas vérifié.
- Le verrouillage définitif d'une puce n'est proposé que si le navigateur l'expose : non vérifié.
- Les enseignants voient dans l'historique d'un objet le libellé (adresse) de l'emprunteur : choix assumé pour savoir qui a le matériel.
- Un enseignant ne peut pas rendre le prêt d'un collègue (vérifié en base locale) ; un gestionnaire le peut.
