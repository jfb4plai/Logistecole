# Logistécole : fiche enrichie, pré-remplissage et critères « Pour qui ? »

Date : 2026-11-03. Suite des specs du socle (`2026-10-13-logistecole-socle-design.md`) et des prêts (`2026-11-03-logistecole-prets-design.md`). Statut : brouillon à valider par JF.

## 1. Intention

Le Pôle stocke des livres, des jeux et des outils pédagogiques. Aujourd'hui, encoder un objet demande de tout taper. JF veut deux choses :

1. **Réduire le temps d'encodage au strict minimum** : coller un lien de vente (Amazon, Fnac), scanner un ISBN, ou photographier l'objet, puis obtenir une fiche pré-remplie (titre, auteur, éditeur, description…).
2. **Retrouver un objet par ce à quoi il sert** : troubles d'apprentissage, difficultés d'apprentissage, aménagements (AU et AR du catalogue AménagActif), objet physique ou numérique, texte libre.

Pourquoi : JF a déjà encodé à partir d'un lien Fnac ou Amazon et l'a trouvé pratique. Le critère « Pour qui ? » est ce qui distingue Logistécole d'un simple inventaire : un enseignant cherche « un jeu pour un élève dyscalculique », pas « le jeu n° 214 ».

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Un livre s'encode en quelques gestes : lien ou ISBN collé, ou code-barres scanné, vérification, emplacement, enregistrer.
- Un jeu ou un outil s'encode par photo ou par lien, avec repli sur la saisie à la main.
- Les critères « Pour qui ? » se cochent à l'encodage, par tout membre du Pôle (admin et gestionnaire, voir 6.4) ; les enseignants consultent seulement.
- La recherche de l'accueil sait filtrer sur ces critères.

**Non-objectifs (cette version)**
- Aucun critère proposé par l'IA dans le formulaire d'encodage (pas de pré-cochage). L'IA ne propose qu'en lot, dans la file « À valider » (section 8bis).
- Pas d'édition des listes de troubles et de difficultés dans l'interface (elles viennent d'une migration).
- Pas de critères dans l'import Excel/CSV.
- Pas de promesse que Amazon ou Fnac se lisent toujours.

**Anti-objectifs (un échec même si « ça marche »)**
- Enregistrer du texte généré par l'IA sans que la personne l'ait relu.
- Qu'un critère soit présenté comme une prescription ou un avis médical.
- Que l'encodage devienne plus lent qu'aujourd'hui parce que les critères sont obligatoires : sauf « Autre » coché, ils restent facultatifs.
- Qu'une description inventée passe pour une donnée du livre.
- Qu'un critère proposé par l'IA soit visible ou cherchable avant qu'un membre du Pôle l'ait confirmé.

## 3. Contraintes

- Stack existante : React 18 + Vite 5, Supabase partagé (`dfoaumjleqtxjeaplnna`), tables préfixées `logi_`, `GRANT` explicites dans chaque migration, écriture par fonctions `security definer` avec contrôle de rôle, Vercel Functions pour `/api/*` (modèle : `api/inviter.js`).
- Aucune migration appliquée à la base partagée sans l'accord de JF. Le SQL est rejoué d'abord sur le banc PGlite (`tests/sql/`).
- IA : Haiku 5.5 (`claude-haiku-5-5`) par défaut, clé `ANTHROPIC_API_KEY` côté serveur uniquement, sortie JSON via `output_config.format` (pas par consigne de prompt). Sonnet seulement si un essai montre que Haiku lit mal.
- Règle 80/20 : l'IA ne remplit que des champs modifiables ; rien n'est enregistré avant « Enregistrer ». Aucun appel IA sans compte connecté.
- Accessibilité : texte 16 px minimum, cibles tactiles 44 px minimum, pas de menu natif `select multiple` sur téléphone. Chaque champ a un label, un placeholder concret et un texte d'aide qui dit ce que la saisie change (règle PLAI).
- Références scientifiques : la spec n'affirme rien sur l'efficacité d'un objet pour un trouble. Si une définition de trouble est écrite dans l'aide d'un critère, elle passe par une vérification dans le corpus RISS avant d'entrer dans le code (sinon « réel, hors corpus RISS »).
- Aucun appel `/api` ne se teste avec `vite dev` : utiliser `vercel dev`. Le projet Vercel n'existe pas encore pour Logistécole : c'est un prérequis des étapes IA et lien (voir 11).
- Branche `main`. `npx vite build` doit passer avant tout push.

## 4. Parcours d'encodage

Les maquettes validées en session sont dans `.superpowers/brainstorm/440-1793688441/content/` (`encodage-fiche.html`, `encodage-pour-qui-v2.html`, `amenagements-chapitres-v3.html`).

**Écran 1 : Nouvel objet.** Une zone d'entrée unique « Coller un lien Amazon / Fnac, ou saisir un ISBN », et trois boutons : « Scanner le code-barres (livre) », « Prendre une photo (jeu, outil) », « Numérique : coller l'adresse ». Un lien « Tout saisir à la main » est toujours présent.

**Écran 2 : fiche pré-remplie** (c'est le formulaire existant `FormulaireObjet.jsx`, étendu) :
- Type : physique / numérique / les deux.
- Nom, auteur, éditeur, ISBN, description (marquée « à relire » tant que la personne ne l'a pas modifiée ou confirmée).
- Bloc « Pour qui ? » **visible** (option A choisie par JF), avec trois listes déroulantes à cocher : troubles, difficultés d'apprentissage, aménagements. Chaque liste se termine par « Autre (préciser) ».
- Emplacement, catégorie, enregistrer.

**« Autre (préciser) »** : si coché, un champ de description s'ouvre et devient obligatoire. Une liste sans « Autre » coché n'a pas de champ de texte. Le texte reste attaché à l'objet et se cherche comme du texte libre ; il n'ajoute pas de case aux listes.

**Sélecteur d'aménagements** : on liste d'abord les chapitres du catalogue AménagActif. Chaque chapitre se coche en entier, ou se déplie pour choisir des aménagements précis. Dans un chapitre, les aménagements AU et AR figurent tous les deux, avec une étiquette AU ou AR. Cocher le chapitre entier grise le détail (déjà inclus). Un chapitre partiellement choisi affiche « 2 sur 5 ».

## 5. Sources de pré-remplissage

Chaque source remplit seulement ce qu'elle a trouvé. Un champ non trouvé reste vide. Si une source échoue, un message en français dit quoi faire (la photo, la saisie à la main) et ce qui est déjà saisi n'est pas perdu.

### 5.1 Livre : ISBN (lien, saisie ou scan)
- Un lien Amazon de livre contient l'ISBN-10 (constaté sur 2 liens réels : `/dp/2808113064`, `/dp/2738119743`). L'application l'extrait du lien sans ouvrir la page Amazon, le convertit en ISBN-13 et interroge Open Library, puis Google Books en repli.
- Le scan lit un code-barres EAN-13 (préfixe 978 ou 979). `qr-scanner` (déjà installé) ne lit que les QR : une autre bibliothèque ou `BarcodeDetector` est à choisir par le builder. Exigence : fonctionner sur Android Chrome et sur iPhone Safari (les appareils de JF et du Pôle sont à confirmer), y compris saisie manuelle de l'ISBN en repli.
- La qualité d'Open Library et de Google Books sur des livres pédagogiques francophones n'est pas mesurée. Le builder fait un essai sur 15 à 20 titres réels du Pôle avant de figer le choix, et note ce qui manque (éditeur, description…).

### 5.2 Autre objet : photo
- La photo (compressée côté navigateur par `src/domain/image.js`, déjà présent) part vers une fonction `/api` qui interroge Haiku en vision.
- L'IA ne remplit que ce qui est lisible sur l'image : nom, éditeur ou marque, nombre de joueurs, âge indiqué. Elle ne rédige pas de résumé ; si la boîte ne donne pas de description, le champ reste vide.
- Aide du champ photo : ne pas photographier d'élèves.
- Dépendance : le stockage des photos (bucket `logi-photos`) n'a jamais été essayé en réel (étape 18 de la recette). À faire avant de livrer cette étape.

### 5.3 Autre objet : lien de vente
- Le serveur lit la page, extrait le texte, et le fait lire par Haiku (sortie JSON) pour en tirer titre, marque, nombre de joueurs, âge, description.
- Constat sur 3 pages Amazon.com.be avec une requête simple depuis le PC de JF : 2 pages chargées (un livre, un jeu), 1 refusée (503, captcha). Ces pages n'ont ni OpenGraph ni JSON-LD : on ne peut pas se contenter de lire des balises. Depuis un serveur Vercel, le blocage sera probablement plus fréquent (non testé). Fnac n'est pas testé.
- Cette voie est donc un bonus : si la page ne se lit pas, le message renvoie vers la photo.
- Protection obligatoire (appel serveur vers une adresse saisie par l'utilisateur) : https seulement, refus des adresses privées ou locales (y compris après résolution DNS et après redirection), taille et durée limitées, aucun envoi de cookies ni de jeton.
- Le lien est conservé dans `liens`.

### 5.4 Numérique
- La personne colle l'adresse d'accès. Elle va dans `liens`. Les champs nom, description et critères restent à remplir (le lien peut passer par 5.3).
- Un objet numérique n'a ni prêt, ni réservation, ni QR, ni kit, ni stock ; l'emplacement est facultatif (il l'est déjà en base).

### 5.5 Limites communes
- Un plafond d'appels IA par organisation et par jour (proposition : 100, comme l'invitation en lot), refus clair au-delà.
- Le contrôle d'accès suit `api/inviter.js` : jeton de l'appelant, vérification d'appartenance à l'organisation, rôle autorisé à créer des objets.
- Les journaux serveur ne contiennent ni clé ni contenu de page.

## 6. Modèle de données (migration à numéroter après `20261018`)

### 6.1 Colonnes sur `logi_objets`
- `type_ressource` text : `physique` (défaut), `numerique`, `les_deux`.
- `auteur`, `editeur` (≤ 200), `isbn` (10 ou 13 chiffres, contrôle de clé), `description` (≤ 2000), `description_a_relire` boolean.
- `autre_trouble`, `autre_difficulte`, `autre_amenagement` (≤ 500, nullable). « Autre coché » équivaut à un texte non vide.

### 6.2 Critères
- Table `logi_criteres` (`id`, `famille` : `trouble` ou `difficulte`, `code` unique, `libelle`, `aide`, `ordre`, `actif`). Lecture pour tout membre authentifié, écriture réservée à la migration.
- Liste de départ (à valider par JF avant migration) : troubles = dyslexie, dysorthographie, dyscalculie, dyspraxie, dysphasie, TDAH, TSA ; difficultés = lecture, écriture, calcul, attention, mémoire de travail, langage oral.
- Table de liaison `logi_objets_criteres` (`objet_id`, `critere_id`).

### 6.3 Aménagements
- Table `logi_objets_amenagements` (`objet_id`, `chapitre_id` nullable, `amenagement_id` nullable ; exactement un des deux renseigné), avec clés étrangères vers `ar_chapitres` et `ar_amenagements`, `on delete cascade`.
- Source unique des listes d'aménagements : le catalogue d'AménagActif, sans copie. Logistécole lit `ar_chapitres` (`id, ordre, titre, est_dispositif`) et `ar_amenagements` (`id, chapitre_id, ordre, libelle, type`, filtre `actif = true`), triés par `ordre`, avec la même requête que `useCatalogue` d'AménagActif (`amenagactif/src/hooks/useCatalogue.js`) et la page « liste complète » (`CatalogueAmenagements.jsx`). Toute modification du catalogue par le Pôle apparaît donc d'elle-même dans les listes de Logistécole.
- Droit de lecture constaté en base le 2026-11-03 (lecture seule) : politiques `ar_ref_read_chap` et `ar_ref_read_amgt` en `using (true)` pour `authenticated` ; `has_table_privilege(select)` vrai pour `authenticated`. `anon` a le privilège mais aucune politique de lecture : un visiteur sans compte ne voit rien, ce qui convient (le sélecteur n'est ouvert qu'aux membres connectés).
- Contenu constaté le même jour : 13 chapitres, 151 aménagements actifs. Chapitres 1 à 12 (de « 1. SUPPORTS ET DOCUMENTS ÉCRITS, MISE EN PAGE & CONSIGNES », 28 éléments, à « 12. INTERACTIONS SOCIALES, COMMUNICATION & GESTION DES COMPORTEMENTS », 6 éléments), puis chapitre 13 « Dispositif de régulation des comportements » (7 éléments). Les titres portent déjà leur numéro : on les affiche tels quels, sans renuméroter. Plusieurs chapitres ne contiennent que des AR (5, 7, 9, 10, 11, 12), d'autres mêlent AU et AR (1 : 6 AU et 22 AR).
- Les codes stables d'AménagActif ne couvrent que les chapitres 1, 5, 7 et 9 (45 éléments, migration `20260924c`). On référence donc par identifiant, pas par code. AménagActif refuse la suppression d'un aménagement déjà utilisé et préfère le désactiver (migration `20261012b`) : la fiche doit tenir compte du drapeau `actif` (un aménagement désactivé reste affiché sur les fiches qui l'ont, mais n'est plus proposé).
- Chapitre « dispositif » (`est_dispositif`, migration `20261002`) : un seul aujourd'hui, le 13. Il est proposé comme les autres, mais ses éléments portent l'étiquette « Dispositif » et non AU ou AR (ils sont AU ou AR selon la classe), comme sur la page de liste complète d'AménagActif. Les 7 éléments sont stockés avec `type = 'AR'` : ne pas s'y fier pour l'affichage.

### 6.4 Droits
- Créer un objet reste réservé aux rôles `admin` et `gestionnaire` (politique existante). Les enseignants (`emprunteur`) et le rôle `lecture` ne créent pas de matériel.
- **Décision de JF** : tout membre du Pôle (rôles `admin` et `gestionnaire`) peut poser et modifier les critères, la charge ne repose pas sur une seule personne. Les enseignants (`emprunteur`) ne modifient rien : s'ils voient une correction à faire, ils la communiquent à leur référent, hors de l'application. Aucune fonction de signalement dans l'application en v1.
- Les politiques d'écriture des nouvelles tables de liaison reprennent celles de `logi_objets` (`admin`, `gestionnaire`). Pas de fonction dédiée ouverte aux enseignants.
- Chaque modification de critères est écrite dans `logi_historique` avec son auteur (l'historique est déjà sans `update` ni `delete`).

## 7. Recherche

Accueil : « Texte libre » et « Physique / numérique » toujours visibles, les autres filtres sous un bouton « Filtres » : catégorie, emplacement, trouble, difficulté, aménagement (chapitre ou précis, AU/AR), état.
- Le texte libre cherche dans nom, auteur, éditeur, ISBN, description, notes, et les trois textes « Autre ».
- Dans une famille, les cases cochées se combinent en OU ; entre familles, en ET (choix du rédacteur).
- Filtrer par chapitre trouve aussi les objets liés à un aménagement précis de ce chapitre.
- Le filtre actuel (`src/domain/filtres.js`) travaille côté navigateur sur tous les objets : on l'étend. À cette échelle (centaines d'objets), pas de recherche serveur.

## 8. Cohérence des critères

JF le dit : poser un critère reste subjectif. On ne le supprime pas, on le cadre :
- listes fermées, avec un court texte d'aide sous chaque option qui précise ce qu'on entend par là (rédigé avec JF, vérifié RISS s'il décrit un trouble) ;
- une phrase visible sur la fiche : « Étiquettes indicatives posées par l'équipe, pas une prescription » ;
- l'auteur et la date de chaque pose figurent dans l'historique ;
- une vue pour les administrateurs avec les textes saisis dans « Autre », par famille, pour décider d'ajouter une vraie case (la promotion elle-même se fait par migration dans cette version).

## 8bis. Import de la base existante et file « À valider »

JF dispose d'une grosse base encodée dans un logiciel spécifique, exportable en Excel. L'Excel a une structure propre à ce logiciel, à décoder pour l'importation uniquement (pas de synchronisation continue).

### 8bis.1 Décodage de l'export (sans IA)
- La correspondance colonnes vers champs est écrite une fois, en code, pour ce format fixe (extension de `src/domain/import.js` et de `src/pages/Import.jsx`). Elle est testée sur un échantillon réel.
- Prérequis : la structure du fichier (en-têtes et une vingtaine de lignes, sans nom de personne) n'a pas encore été fournie. Le détail de l'import se fixe à sa réception.
- Si l'export contient des ISBN, auteur, éditeur et description se complètent par la recherche de la section 5.1, sans IA.
- Les colonnes contenant des noms d'emprunteurs ou un historique de prêts ne sont jamais envoyées à l'API et ne sont pas importées sans décision de JF.
- Les objets importés apparaissent dans la recherche par texte, sans critère. Un compteur « À compléter » les rend visibles.

### 8bis.2 Propositions de l'IA en lot, file « À valider » (voie choisie par JF)
- Une fonction `/api` parcourt les objets sans critère et demande à Haiku de proposer, pour chacun, des troubles, des difficultés et des aménagements. Entrée : nom, auteur, éditeur, description, catégorie. Sortie : JSON qui ne peut contenir que des éléments des listes (identifiants fournis dans la consigne) ; « aucun critère » est une réponse valable et attendue en cas de doute.
- Les propositions sont stockées dans une table `logi_propositions` (`objet_id`, famille, cible : critère, chapitre ou aménagement comme en 6.3, `statut` : `en_attente`, `acceptee`, `refusee`, modèle utilisé, date, `decide_par`, `decide_le`). Écriture par la fonction serveur seulement.
- Une proposition en attente est **invisible** dans la recherche, sur la fiche pour les enseignants, et dans les filtres. Seuls `admin` et `gestionnaire` la voient, dans l'écran « À valider ».
- Écran « À valider » : un objet à la fois (nom, description, catégorie), ses propositions avec la mention « proposé par l'IA, à confirmer », et pour chacune « Accepter » ou « Refuser », plus « Accepter celles de cet objet ». Pas de bouton « tout accepter » pour l'ensemble de la file (appel du rédacteur : il viderait la file sans relecture).
- Accepter écrit le critère dans les tables de 6.2/6.3 et dans l'historique (« validé par X, proposé par l'IA »). Refuser conserve la ligne avec le statut `refusee` pour ne jamais re-proposer la même chose.
- Mesure avant tout déploiement large : un essai sur 50 objets réels, relus par JF, avec relevé du taux de propositions acceptées. JF fixe le seuil en dessous duquel la file ne vaut pas la peine. Aucun chiffre n'est annoncé sans cet essai.
- Coût : sans importance (de l'ordre de 0,02 centime par objet avec Haiku 5.5, estimation non mesurée, effort de réflexion au minimum) ; le coût réel est le temps de validation humaine. Le traitement par lots asynchrones de l'API (moitié prix) est possible, choix laissé au builder.
- Plafond d'appels IA par jour identique à 5.5, et reprise possible là où le lot s'est arrêté.

## 9. Appels du rédacteur (JF peut les défaire)

- L'IA ne pré-coche jamais le formulaire d'encodage : un pré-cochage ancre la décision. Elle propose uniquement en lot, dans la file « À valider ». Pas de bouton « tout accepter » global.
- OU dans une famille, ET entre familles.
- Critères absents de l'import Excel/CSV en v1 ; l'import accepte auteur, éditeur, ISBN, description, type.
- « Autre » n'ajoute pas de case aux listes.
- Plafond de 100 appels IA par jour et par organisation.
- Chapitre « dispositif » proposé comme les autres, étiqueté « Dispositif » (pas AU/AR).
- Liste de troubles et de difficultés de départ (6.2).
- Le marqueur « à relire » disparaît quand la personne modifie la description ou coche « J'ai relu ».

## 10. Tests et vérification

- SQL rejoué sur PGlite : contraintes (un seul de chapitre/aménagement), droits d'écriture des critères (lecture et emprunteur refusés), `description` plafonnée, `isbn` contrôlé, `GRANT` explicites. Mutations pour s'assurer que les tests détectent une erreur.
- Tests unitaires : extraction d'ISBN depuis une URL Amazon, conversion ISBN-10 vers ISBN-13, validation de clé, garde SSRF (adresses privées, redirections), filtres combinés.
- Essais réels, par JF : 15 à 20 livres, jeux et outils du Pôle, avec relevé de ce qui est lu, de ce qui manque, de ce qui est faux. Aucun « fonctionne » sans ce relevé.
- Recette sur téléphone : scan du code-barres, photo, formulaire à 44 px. Jamais essayés à ce jour.

## 11. Ordre de livraison

1. Modèle, critères, aménagements, type physique/numérique, description, recherche (aucune IA).
2. ISBN : extraction du lien, saisie, scan, recherche Open Library/Google Books.
3. Projet Vercel, domaine, clé API ; puis photo (Haiku vision).
4. Lien de vente non-livre.
5. Import de la base existante (décodage de l'Excel). À avancer avant l'étape 2 si la base est la priorité : il n'exige pas l'IA, seulement l'échantillon du fichier.
6. File « À valider » et propositions de critères par l'IA (nécessite l'étape 3 : Vercel et clé API), d'abord en essai sur 50 objets.

Chaque étape se livre seule, avec build vert, tests et accord de JF avant toute migration en production.

## 12. Questions pour JF

- Fournir les en-têtes et une vingtaine de lignes de l'export Excel (sans nom de personne) pour fixer 8bis.1.
- Fixer le seuil d'acceptation de l'essai sur 50 objets (8bis.2).
- Valider ou corriger les listes de troubles et de difficultés (6.2).
