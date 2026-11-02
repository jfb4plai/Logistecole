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
5. `C:\Users\jfbeg\OneDrive\claude-workspace\logistecole\supabase\seed-organisation-essai.sql` : crée « Pôle PLAI (essai) » avec `jf.beguin@outlook.com` comme administrateur.

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
