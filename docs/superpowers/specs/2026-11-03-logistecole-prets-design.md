# Logistécole — sous-projets 2 à 6 : prêts, kits, achat, pannes, stock, réservations, import

Date : 2026-11-03. Suite de la spec du socle (`2026-10-13-logistecole-socle-design.md`, section 11). JF a demandé de coder tous les objectifs ; cette note fixe le design et les arbitrages pour ne pas coder à l'aveugle.

## Arbitrages (rulings) pris faute de réponse explicite

- Facture : un lien et/ou une photo compressée (même bucket que les photos d'objets). Pas de PDF : il ferait grossir le stockage gratuit.
- Rappel de retour : visible dans l'app seulement (« Mes emprunts », « Suivi »). Aucun e-mail automatique.
- Champs d'achat : ajoutés maintenant au modèle (un historique d'achat ne se rattrape pas).
- Comptes enseignants (option A) : nouveau rôle de membre `emprunteur` (libellé « Enseignant »). Il consulte, emprunte, rend ses propres prêts, réserve, signale une panne. Il ne modifie ni ne crée de matériel.
- L'emprunteur est une fiche `logi_emprunteurs` ; pour un compte enseignant, la fiche est créée automatiquement au premier emprunt (libellé = adresse e-mail, tronquée à 60 caractères). Les enseignants voient dans l'historique d'un objet le libellé de l'emprunteur : choix assumé (savoir qui a la valise).
- Vérification : tout le SQL est rejoué sur un Postgres local (PGlite) avant d'être proposé à JF. Rien n'est appliqué à la base partagée sans son accord.

## Modèle (migration `20261014_logistecole_prets.sql`)

- `logi_membres.role` accepte aussi `emprunteur`.
- `logi_objets` gagne : `date_achat`, `fournisseur`, `prix_achat`, `garantie_fin`, `numero_serie`, `facture_url`, `facture_photo_path`, `financement`, `liens` (jsonb, tableau de `{titre, url}`, 10 au plus, http/https seulement), `parent_id` (kit : un seul niveau), `consommable`, `quantite`, `seuil_min`.
- `logi_historique` accepte les types `achat`, `pret`, `retour`, `retour_partiel`, `panne`, `reparation`, `stock`, `reservation`. Toujours sans `update` ni `delete`. Le client n'insère toujours que `correction` et `note`.
- `logi_prets` : un prêt par objet (et un par élément de kit, regroupés par `groupe_id`), `echeance` (date), `retour_le`, `etat_retour`. Index unique partiel : un seul prêt ouvert par objet.
- `logi_reservations` : créneau `[debut, fin)` par objet, statut `active | annulee | terminee`, pas de chevauchement entre réservations actives (verrou consultatif + test dans la fonction).
- Écriture uniquement par fonctions `security definer` avec contrôle de rôle explicite : `logi_preter`, `logi_emprunter`, `logi_rendre`, `logi_prolonger`, `logi_signaler`, `logi_reparer`, `logi_ajuster_stock`, `logi_reserver`, `logi_annuler_reservation`. Les tables de prêts et de réservations n'accordent que `select` aux utilisateurs.
- `logi_creer_objets` accepte les champs d'achat, les liens, le kit et le stock.

## Règles métier

- Un kit = un objet racine + ses éléments (`parent_id`). Un élément ne se prête pas seul. Emprunter la racine prête tous les éléments en état `bon` ou `use` ; les autres sont laissés de côté et la fiche de la racine le note.
- Retour partiel : les éléments non rendus restent ouverts ; la racine reçoit une entrée « Rendu incomplet : il manque… ».
- Un consommable ne se prête pas ni ne se réserve ; il se gère par entrées et sorties de stock (`stock`), jamais sous zéro. « Sous le seuil » = `quantite <= seuil_min`.
- Prêt refusé si l'objet est défectueux, perdu, sorti, déjà prêté, ou réservé par quelqu'un d'autre sur la période. Le détenteur d'une réservation qui emprunte la convertit (statut `terminee`).
- Échéance : entre aujourd'hui et 365 jours. Proposition par défaut : 7 jours.
- Un enseignant ne rend que ses propres prêts ; un gestionnaire rend n'importe lequel et corrige l'état.
- Signaler une panne : tout membre ; réparer : gestionnaire ou administrateur.

## Application

- Écrans : fiche enrichie (disponibilité, emprunter / prêter / rendre, kit, achat, liens, réservations, panne, stock, NFC), « Mes emprunts », « Suivi » (prêts en cours et en retard, à réparer, stock bas, réservations à venir), import Excel/CSV (admin), invitation en lot (rôle `emprunteur` inclus).
- Fonctions pures testées : échéances, kit, liens, créneaux, analyse d'import, lecture CSV.
- NFC : `src/lib/nfc.js` repris du garde-manger (écriture d'un enregistrement `url`), bouton affiché seulement si le navigateur le permet (Android Chrome).
- Hors périmètre : rappels par e-mail, comptabilité, amortissement, hors ligne, envoi de notifications.

## Vérification possible sans la base de JF

Banc `tests/sql/` (PGlite) pour le SQL et les politiques RLS ; tests unitaires pour le domaine ; tests de composants avec la couche données simulée. Ce qui ne se vérifie qu'avec la vraie base, une vraie connexion et de vrais téléphones est listé dans la recette.
