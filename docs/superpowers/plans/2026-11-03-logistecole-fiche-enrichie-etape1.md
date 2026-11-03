# Logistécole : fiche enrichie, étape 1 (modèle, critères « Pour qui ? », recherche) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un membre du Pôle encode un objet avec type physique/numérique, auteur, éditeur, ISBN, description et critères « Pour qui ? » (troubles, difficultés, aménagements du catalogue AménagActif), et tout membre retrouve les objets par ces critères. Aucune IA, aucun appel `/api`.

**Architecture:** Une migration (`20261019`) ajoute des colonnes à `logi_objets`, deux tables de liaison en lecture seule pour les utilisateurs et une fonction `logi_definir_criteres` (security definer, rôle contrôlé) qui remplace en bloc les critères d'un objet. Les listes d'aménagements viennent des tables `ar_chapitres` et `ar_amenagements` d'AménagActif, lues directement. La logique (ISBN, « Autre », sélection chapitre/détail, filtres) vit dans `src/domain/` en fonctions pures testées ; les composants React sont des briques sans accès aux données.

**Tech Stack:** React 18, Vite 5, Supabase (Postgres, RLS), Vitest + Testing Library, PGlite pour le SQL.

**Spec:** `docs/superpowers/specs/2026-11-03-logistecole-fiche-enrichie-design.md` (sections 4 écran 2, 5.4, 6, 7, 8, 9, 10 ; ordre de livraison 11, étape 1). Les étapes 2 à 6 de la section 11 (ISBN par lien/scan, photo, lien de vente, décodage de l'Excel, file « À valider ») auront chacune leur plan ; l'écran 1 « Nouvel objet » en fait partie.

## Global Constraints

- Tables préfixées `logi_` ; `GRANT` explicites dans la migration ; écriture par fonctions `security definer` avec contrôle de rôle ; `anon` sans aucun droit.
- Aucune migration appliquée à la base partagée `dfoaumjleqtxjeaplnna` sans l'accord de JF (Task 16 est bloquée par cet accord). Le SQL se rejoue d'abord sur PGlite (`tests/sql/`).
- Texte 16 px minimum, cibles tactiles 44 px minimum, pas de `select multiple` natif.
- Chaque champ de formulaire : label, placeholder concret, texte d'aide sous le champ qui dit ce que la saisie change (`ChampGuide`).
- « Autre (préciser) » : texte obligatoire dès que la case est cochée, 500 caractères maximum, ne crée jamais de case dans les listes.
- Combinaison des filtres : OU dans une famille, ET entre familles.
- Mention visible sur la fiche : « Étiquettes indicatives posées par l'équipe, pas une prescription. »
- Créer ou modifier un objet et ses critères : rôles `admin` et `gestionnaire` seulement. Les rôles `lecture` et `emprunteur` consultent.
- Un objet `numerique` n'a ni prêt, ni réservation, ni étiquette, ni kit, ni stock.
- Aucune référence scientifique ni définition de trouble n'est écrite dans le code : les textes d'aide des critères décrivent l'usage de l'étiquette, pas le trouble.
- Branche `main` ; `npx vite build` doit passer avant tout `git push` (le push lui-même attend l'accord de JF). Les messages de commit se terminent par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Le catalogue AménagActif ne se charge pas (réseau, droits) : le formulaire reste utilisable, affiche un message, et l'enregistrement n'efface aucun aménagement déjà lié (Task 11 : `definirCriteres` n'est appelé que si le bloc est chargé et touché).
2. Un aménagement désactivé dans AménagActif mais déjà lié à une fiche : il reste affiché sur la fiche et dans le formulaire, n'est plus proposé aux autres fiches, et un nouvel enregistrement ne le retire pas (Tasks 2, 6, 10).
3. « Autre » coché sans texte est refusé ; texte tapé puis case décochée n'enregistre rien (`null`) (Tasks 5, 11).
4. Objets existants sans les nouveaux champs (`type_ressource` absent côté démo, listes de liens vides, `description` nulle) : ni filtre ni affichage ne plantent (Tasks 7, 12, 13).
5. Un objet numérique ne se prête pas même par appel direct à la base (Task 3), et sa fiche ne montre aucune action de prêt (Task 8).

---

### Task 1: Migration, partie 1 : colonnes de la fiche et création en lot

**Files:**
- Modify: `tests/sql/harness.js` (gabarit `IMITATION_SUPABASE`)
- Create: `supabase/migrations/20261019_logistecole_fiche_enrichie.sql`
- Create: `supabase/tests/logistecole_fiche.sql`
- Create: `tests/sql/fiche.test.js`

**Interfaces:**
- Produces (SQL) : fonction `logi_isbn_valide(p text) returns boolean` (immutable ; vrai pour 10 ou 13 caractères avec clé correcte, `X` final accepté en ISBN-10, sans tirets) ; colonnes de `logi_objets` : `type_ressource text not null default 'physique'` (`physique`, `numerique`, `les_deux`), `auteur`, `editeur` (≤ 200), `isbn` (null ou valide), `description` (≤ 2000), `description_a_relire boolean not null default false`, `autre_trouble`, `autre_difficulte`, `autre_amenagement` (null ou 1 à 500 caractères après `trim`) ; `logi_creer_objets(p_org uuid, p_objets jsonb)` accepte aussi ces clés (`type_ressource` défaut `physique`).
- Produces (tests) : le harness crée les tables `ar_chapitres(id, ordre, titre, est_dispositif)` et `ar_amenagements(id, chapitre_id, ordre, libelle, type, actif)` avant les migrations ; verdict attendu du script : `LOGISTECOLE FICHE : tous les tests passent`.

- [ ] **Step 1: Write the failing test.** `tests/sql/fiche.test.js` sur le modèle de `socle.test.js` : `creerBase()` (toutes les migrations), `executerScript(db, 'supabase/tests/logistecole_fiche.sql')`, attend le verdict ci-dessus (timeout 120000). `supabase/tests/logistecole_fiche.sql` : même préambule que `logistecole_prets.sql` (fonctions `zz_echec`, `zz_lignes`, `zz_comme`, `begin`), mêmes organisations A et B et mêmes cinq membres (admin, gestionnaire, lecture, deux emprunteurs), plus un administrateur de B ; assertions de cette tâche :
  - `logi_isbn_valide('9782738119742')`, `('2738119743')`, `('9782808113069')`, `('2808113064')` vrais ; `('9782738119743')`, `('273811974')`, `('abc')`, `('')` faux.
  - Insertion directe d'un objet avec `isbn = '9782738119743'` refusée (SQLSTATE `23514`), avec `type_ressource = 'autre'` refusée, avec `description` de 2001 caractères refusée, avec `autre_trouble = '   '` refusée.
  - `logi_creer_objets` appelé comme gestionnaire avec `{nom, categorie_id, code, type_ressource:'numerique', auteur:'A. Auteur', isbn:'9782738119742', description:'Texte'}` : la ligne relue porte ces valeurs ; sans `type_ressource` dans le JSON, la ligne relue a `physique`.
  - Le script se termine par `rollback;` puis `select 'LOGISTECOLE FICHE : tous les tests passent';` comme les scripts existants.
- [ ] **Step 2: Run** `npx vitest run tests/sql/fiche.test.js` — FAIL (colonnes et fonction absentes).
- [ ] **Step 3: Implement.** (a) Harness : ajouter au gabarit les deux tables `ar_*` ci-dessus (`ar_amenagements.chapitre_id` référence `ar_chapitres(id)`, `type` text, `actif boolean default true`). (b) Migration `begin; … commit;` avec en-tête qui dit qu'elle dépend des tables `ar_chapitres` et `ar_amenagements` d'AménagActif (présentes en production) : fonction `logi_isbn_valide` (SQL ou plpgsql, calcul de clé ISBN-10 modulo 11 et ISBN-13 modulo 10) ; `alter table logi_objets add column …` avec les contraintes de l'interface ; `create or replace function logi_creer_objets` : reprendre à l'identique la version de `20261014_logistecole_prets.sql:445-468` en ajoutant les nouvelles colonnes au `insert` et au `jsonb_to_recordset` (`coalesce(o.type_ressource, 'physique')`, `coalesce(o.description_a_relire, false)`), puis rejouer ses `revoke` et `grant` (`revoke all … from public, anon; grant execute … to authenticated`).
- [ ] **Step 4: Run** `npx vitest run tests/sql` — PASS pour `fiche`, `socle`, `prets`, `mutations` (les tests existants ne régressent pas).
- [ ] **Step 5: Commit** `git add tests/sql supabase && git commit -m "feat(sql): colonnes de la fiche enrichie, ISBN contrôlé, création en lot étendue"`.

---

### Task 2: Migration, partie 2 : critères, aménagements et `logi_definir_criteres`

**Files:**
- Modify: `supabase/migrations/20261019_logistecole_fiche_enrichie.sql`
- Modify: `supabase/tests/logistecole_fiche.sql`

**Interfaces:**
- Consumes : Task 1 (fichiers, harness, `ar_*` de test).
- Produces (SQL) :
  - `logi_criteres(id uuid pk, famille text ('trouble'|'difficulte'), code text unique, libelle text, aide text, ordre int, actif boolean default true)`, lecture `authenticated` (politique `using (true)`), aucune écriture pour `authenticated`, `service_role` tous droits, `anon` rien. Contenu de départ (code → libellé) : troubles `dyslexie` Dyslexie, `dysorthographie` Dysorthographie, `dyscalculie` Dyscalculie, `dyspraxie` Dyspraxie, `dysphasie` Dysphasie, `tdah` TDAH, `tsa` TSA ; difficultés `lecture` Lecture, `ecriture` Écriture, `calcul` Calcul, `attention` Attention, `memoire_travail` Mémoire de travail, `langage_oral` Langage oral. `aide` = « Utile à des élèves concernés par : <libellé en minuscules, sauf TDAH et TSA>. Étiquette indicative. » (proposition de rédaction, à relire par JF ; ce n'est pas une définition du trouble).
  - `logi_objets_criteres(objet_id, critere_id)` clé primaire composée, `objet_id` → `logi_objets` `on delete cascade`, `critere_id` → `logi_criteres` `on delete restrict`.
  - `logi_objets_amenagements(objet_id, chapitre_id, amenagement_id)` : `check (num_nonnulls(chapitre_id, amenagement_id) = 1)` ; `chapitre_id` → `ar_chapitres(id) on delete cascade` ; `amenagement_id` → `ar_amenagements(id) on delete cascade` ; index uniques partiels `(objet_id, chapitre_id)` et `(objet_id, amenagement_id)`.
  - `logi_org_de_objet(p_objet uuid) returns uuid` (security definer, stable) ; politiques `select` des deux tables de liaison : `logi_est_membre(logi_org_de_objet(objet_id))` ; `authenticated` n'a que `select` sur ces deux tables.
  - `logi_definir_criteres(p_objet uuid, p_criteres uuid[], p_chapitres uuid[], p_amenagements uuid[]) returns void` (security definer, `search_path = public`) : exécutable par `authenticated` seulement ; lève `42501` si l'appelant n'est pas `admin` ou `gestionnaire` de l'organisation de l'objet ; remplace les trois ensembles ; refuse (`23514`, message en français) un critère inactif ou un aménagement inactif qui n'est pas déjà lié à l'objet ; un aménagement dont le chapitre est dans `p_chapitres` n'est pas stocké (le chapitre entier l'inclut) ; écrit une ligne `logi_historique` de type `modification`, `commentaire = 'critères'`, `avant`/`apres` = « <libellés des critères séparés par ", "> | chapitres : n | aménagements : m » (tronqués à 300), seulement si l'ensemble a changé.
  - Trigger `logi_trace_fiche` (after update sur `logi_objets`, security definer) : une ligne `modification` avec `commentaire` valant `autre trouble`, `autre difficulté`, `autre aménagement`, `description`, `type`, `ISBN` pour chaque champ modifié (`avant`/`apres` tronqués à 300).

- [ ] **Step 1: Write the failing test.** Compléter `logistecole_fiche.sql` (jeu de données : un chapitre `c1` avec trois aménagements dont un inactif `a3` et deux actifs `a1` (AU) `a2` (AR) ; un chapitre dispositif `c2` avec `a4` ; un objet `O1` dans A, un objet `O2` dans B). Assertions :
  - 13 critères au départ (7 troubles, 6 difficultés) ; `authenticated` ne peut pas `insert` dans `logi_criteres` ni dans les deux tables de liaison (SQLSTATE `42501`) ; `anon` ne peut rien lire.
  - Gestionnaire A : `logi_definir_criteres(O1, {dyslexie}, {}, {a1})` réussit ; 1 ligne dans chaque liaison ; 1 ligne d'historique `commentaire = 'critères'` avec `auteur_email` du gestionnaire ; rappel identique : toujours 1 ligne d'historique (aucun changement) ; `p_chapitres = {c1}` et `p_amenagements = {a1}` : seul le chapitre est stocké.
  - Refus `42501` pour `lecture`, `emprunteur`, administrateur de B sur `O1`, et gestionnaire A sur `O2`.
  - Critère inactif (après `update logi_criteres set actif=false` en propriétaire) refusé `23514` ; `a3` inactif refusé `23514` sur un objet qui ne l'a pas, mais accepté (conservé) quand `a3` est déjà lié (lié en propriétaire) et redéfini avec lui.
  - Élève emprunteur A voit les liaisons de `O1` (`select` renvoie des lignes) et ne voit pas celles de `O2`.
  - Supprimer un `ar_amenagements` lié supprime la liaison (cascade).
  - Modifier `autre_trouble` de `O1` écrit une ligne `commentaire = 'autre trouble'`.
- [ ] **Step 2: Run** `npx vitest run tests/sql/fiche.test.js` — FAIL.
- [ ] **Step 3: Implement** la migration selon l'interface (ajouter à la suite du fichier, avant `commit;`). Les `GRANT` suivent le modèle de `20261013b_logistecole_droits.sql` (`revoke all … from anon, authenticated, service_role` puis grants ciblés). Un seul trigger de trace par table, pas de récursion.
- [ ] **Step 4: Run** `npx vitest run tests/sql` — PASS.
- [ ] **Step 5: Commit** `feat(sql): critères, aménagements liés, logi_definir_criteres, trace de la fiche`.

---

### Task 3: Migration, partie 3 : un objet numérique ne se prête pas

**Files:**
- Modify: `supabase/migrations/20261019_logistecole_fiche_enrichie.sql`
- Modify: `supabase/tests/logistecole_fiche.sql`

**Interfaces:**
- Consumes : Task 1 (`type_ressource`), tables `logi_prets` et `logi_reservations` du fichier `20261014`.
- Produces : contrainte `logi_objets_numerique_simple check (type_ressource <> 'numerique' or (parent_id is null and consommable = false))` ; fonction trigger `logi_refuser_numerique()` appelée avant `insert` sur `logi_prets` et sur `logi_reservations` : lève `23514` « Un objet numérique ne se prête pas » quand l'objet visé est `numerique` (un objet `les_deux` reste prêtable).

- [ ] **Step 1: Write the failing test.** Dans le script : objet numérique `N1` ; `logi_preter(N1, …)` par le gestionnaire (signature réelle dans `20261014`) échoue `23514` avec le fragment `numérique` ; `logi_reserver(N1, …)` idem ; `insert into logi_prets` direct en propriétaire échoue aussi ; un objet `les_deux` se prête normalement ; mettre `parent_id` ou `consommable = true` sur `N1` échoue `23514`.
- [ ] **Step 2: Run** `npx vitest run tests/sql/fiche.test.js` — FAIL.
- [ ] **Step 3: Implement** la contrainte et le trigger (security definer, `set search_path = public`).
- [ ] **Step 4: Run** `npx vitest run tests/sql` — PASS.
- [ ] **Step 5: Commit** `feat(sql): un objet numérique ne se prête ni ne se réserve`.

---

### Task 4: Mutations SQL de la fiche

**Files:**
- Modify: `tests/sql/mutations.test.js`

**Interfaces:**
- Consumes : Tasks 1 à 3.

- [ ] **Step 1: Write the failing test.** Ajouter au fichier une seconde liste `mutationsFiche` appliquée à `20261019_logistecole_fiche_enrichie.sql` : base = les sept migrations précédentes (`H.creerBase([...])` sans `20261019`), puis la migration mutée, puis `supabase/tests/logistecole_fiche.sql` doit lever une erreur. Mutations (chacune remplace un fragment exact de la migration et vérifie `muté !== original`) : contrôle de rôle de `logi_definir_criteres` supprimé ; vérification de l'organisation de l'objet supprimée ; contrainte `num_nonnulls` supprimée ; clé ISBN non contrôlée (`logi_isbn_valide` renvoie toujours vrai) ; trigger `logi_refuser_numerique` retiré ; filtre « inactif non déjà lié » supprimé ; politique `select` des liaisons remplacée par `using (true)`.
- [ ] **Step 2: Run** `npx vitest run tests/sql/mutations.test.js` — les nouvelles mutations échouent à `expect(muté).not.toBe(original)` tant que les fragments ne correspondent pas exactement ; ajuster les fragments au texte réel de la migration jusqu'à ce que chaque mutation soit appliquée.
- [ ] **Step 3: Run** à nouveau — PASS (chaque mutation fait échouer le script SQL, donc est détectée).
- [ ] **Step 4: Commit** `test(sql): mutations de la migration fiche enrichie`.

---

### Task 5: Domaine : ISBN, types de ressource, « Autre »

**Files:**
- Create: `src/domain/isbn.js`, `src/domain/criteres.js`
- Test: `tests/domain/isbn.test.js`, `tests/domain/criteres.test.js`

**Interfaces:**
- Produces :
  - `normaliserIsbn(saisie: string): string | null` : retire espaces et tirets, accepte 10 ou 13 caractères à clé correcte (`X` final majuscule ou minuscule en ISBN-10), renvoie toujours 13 chiffres (préfixe 978 pour un ISBN-10), sinon `null`.
  - `TYPES_RESSOURCE: {value: 'physique'|'numerique'|'les_deux', label: string}[]` (libellés Physique, Numérique, Les deux).
  - `MENTION_INDICATIVE: string` = « Étiquettes indicatives posées par l'équipe, pas une prescription. »
  - `autresVides(): {trouble, difficulte, amenagement}` chacun `{coche: false, texte: ''}` ; `autresDepuisObjet(objet): même forme` (coché si `autre_trouble` / `autre_difficulte` / `autre_amenagement` non vide).
  - `validerAutres(autres): {ok: true, valeurs: {autre_trouble, autre_difficulte, autre_amenagement}} | {ok: false, erreurs: string[]}` : texte `trim` ; non coché → `null` même si du texte est resté ; coché sans texte → erreur « « Autre » est coché dans <Troubles|Difficultés d'apprentissage|Aménagements> : décrivez-le, ou décochez-le. » ; plus de 500 caractères → erreur.

- [ ] **Step 1: Write the failing tests.** `normaliserIsbn('2-7381-1974-3')` = `'9782738119742'` ; `normaliserIsbn('2808113064')` = `'9782808113069'` ; `normaliserIsbn('978 2 8081 1306 9')` = `'9782808113069'` ; `normaliserIsbn('9782738119743')`, `('')`, `('12345')` = `null` ; ISBN-10 terminé par `x` minuscule valide accepté (construire un exemple dont la somme pondérée donne 10 pour le dernier chiffre). `validerAutres` : trois cas (non coché avec texte résiduel → `null`, coché vide → erreur nommant la famille, coché à 501 caractères → erreur, coché à `'  élèves allophones '` → valeur `'élèves allophones'`). `autresDepuisObjet({autre_trouble: 'x'})`.
- [ ] **Step 2: Run** `npx vitest run tests/domain/isbn.test.js tests/domain/criteres.test.js` — FAIL.
- [ ] **Step 3: Implement** les deux modules avec les signatures ci-dessus.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(domaine): ISBN et saisie « Autre »`.

---

### Task 6: Domaine : catalogue d'aménagements et sélection

**Files:**
- Create: `src/domain/amenagements.js`
- Test: `tests/domain/amenagements.test.js`

**Interfaces:**
- Produces :
  - `organiserCatalogue({chapitres, amenagements}, {dejaChoisis = []} = {}): Chapitre[]` avec `Chapitre = {id, ordre, titre, estDispositif: boolean, items: {id, libelle, etiquette: 'AU'|'AR'|'Dispositif', desactive: boolean}[]}`. Entrées : lignes `ar_chapitres` (`id, ordre, titre, est_dispositif`) et `ar_amenagements` (`id, chapitre_id, ordre, libelle, type, actif`). Tri par `ordre`. `etiquette` = `'Dispositif'` quand le chapitre est un dispositif, sinon `type`. Un aménagement `actif = false` n'apparaît que si son id est dans `dejaChoisis` (avec `desactive: true`). Un chapitre sans item reste listé.
  - `selectionVide(): {chapitres: [], amenagements: []}` (listes d'identifiants) ; `selectionDepuisObjet(objet): sélection` à partir de `objet.chapitre_ids` et `objet.amenagement_ids`.
  - `basculerChapitre(sel, chapitre): sel` : retire le chapitre s'il est choisi ; sinon l'ajoute et retire de `sel.amenagements` tous les items de ce chapitre.
  - `basculerAmenagement(sel, chapitre, amenagementId): sel` : ne change rien si le chapitre est choisi en entier ; sinon ajoute ou retire l'id.
  - `resumeChapitre(sel, chapitre): {entier: boolean, choisis: number, total: number}` ; `libelleSelection(sel): string` (« Aucun », « 1 chapitre », « 2 chapitres, 3 aménagements »…) ; `chapitreDeAmenagement(catalogue): Map<amenagementId, chapitreId>`.

- [ ] **Step 1: Write the failing tests** (jeu de données : chapitre « 1. SUPPORTS… » avec 2 AU/AR et 1 désactivé, chapitre dispositif avec 1 item `type: 'AR'`) : étiquette `'Dispositif'` pour l'item du dispositif malgré `type: 'AR'` ; désactivé absent sans `dejaChoisis`, présent avec `desactive: true` s'il y figure ; `basculerChapitre` retire les détails du chapitre mais garde ceux d'un autre chapitre ; `basculerAmenagement` sans effet quand le chapitre est entier ; `resumeChapitre` donne `{entier: false, choisis: 2, total: 3}` ; `libelleSelection(selectionVide())` = `'Aucun'`.
- [ ] **Step 2: Run** `npx vitest run tests/domain/amenagements.test.js` — FAIL.
- [ ] **Step 3: Implement.** Fonctions pures, sans mutation de l'argument.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(domaine): catalogue d'aménagements et sélection chapitre/détail`.

---

### Task 7: Domaine : filtres étendus

**Files:**
- Modify: `src/domain/filtres.js`
- Test: `tests/domain/filtres.test.js` (compléter, ne pas casser les tests existants)

**Interfaces:**
- Consumes : forme d'objet produite par la Task 9 : `critere_ids: string[]`, `chapitre_ids: string[]`, `amenagement_ids: string[]` (peuvent être absents), `type_ressource` (peut être absent = `physique`), plus `auteur`, `editeur`, `isbn`, `description`, `autre_*`.
- Produces : `filtrerObjets(objets, filtres, contexte = {})` avec `filtres = {q, categorieId, emplacementId, etat, type: ''|'physique'|'numerique', critereIds: string[], chapitreIds: string[], amenagementIds: string[]}` et `contexte = {criteres: {id, famille}[], chapitreDeAmenagement: Map}`. Règles : le texte libre cherche aussi dans auteur, éditeur, description, les trois `autre_*` et l'ISBN (comparé sans tirets ni espaces, comme `code`) ; `type: 'physique'` garde `physique` et `les_deux`, `'numerique'` garde `numerique` et `les_deux` ; `critereIds` est réparti par famille grâce à `contexte.criteres` : OU dans une famille, ET entre familles ; la famille « aménagements » rassemble `chapitreIds` et `amenagementIds` en OU, un chapitre trouve aussi les objets liés à un aménagement précis de ce chapitre (via `chapitreDeAmenagement`), et un aménagement précis trouve aussi les objets liés à son chapitre entier.

- [ ] **Step 1: Write the failing tests** : texte « 978-2-7381 » trouve l'objet d'ISBN `9782738119742` ; texte « allophones » trouve via `autre_trouble` ; `type: 'numerique'` garde un `les_deux` et exclut un `physique` ; objet sans `type_ressource` compte comme physique ; deux troubles cochés = OU ; un trouble + une difficulté = ET ; filtre chapitre trouve un objet lié seulement à un détail du chapitre ; filtre détail trouve un objet lié au chapitre entier ; objet dont `critere_ids` est absent n'est trouvé par aucun filtre de critère et ne fait pas planter ; aucun filtre = comportement actuel (les anciens tests passent sans changement).
- [ ] **Step 2: Run** `npx vitest run tests/domain/filtres.test.js` — FAIL sur les nouveaux cas.
- [ ] **Step 3: Implement** en gardant la signature compatible (`filtres` et `contexte` facultatifs).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(domaine): filtres par type, critères et aménagements`.

---

### Task 8: Domaine : actions d'un objet numérique, étiquettes

**Files:**
- Modify: `src/domain/actions.js`, `src/pages/Etiquettes.jsx`
- Test: `tests/domain/actions.test.js`, `tests/pages/pages.test.jsx`

**Interfaces:**
- Consumes : `type_ressource` de l'objet.
- Produces : `actionsFiche` renvoie `emprunter`, `preter`, `rendre`, `prolonger`, `reserver`, `signaler`, `reparer`, `ajusterStock`, `ecrireNfc` tous à `false` pour un objet `numerique` (`modifier` reste vrai pour `ecrit`). La page Étiquettes ne propose pas les objets numériques.

- [ ] **Step 1: Write the failing tests.** `actions.test.js` : pour un gestionnaire, objet `numerique` en état `bon` : toutes les actions ci-dessus fausses, `modifier` vrai ; objet `les_deux` : `preter` vrai. `pages.test.jsx` (suivre le modèle existant de ce fichier) : la page Étiquettes avec un objet numérique et un physique ne liste que le physique.
- [ ] **Step 2: Run** `npx vitest run tests/domain/actions.test.js tests/pages/pages.test.jsx` — FAIL.
- [ ] **Step 3: Implement** : `const numerique = objet.type_ressource === 'numerique'` en tête de `actionsFiche` et neutralisation des actions ; filtre dans `Etiquettes.jsx` sur la liste affichée (`visibles`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: pas de prêt ni d'étiquette pour un objet numérique`.

---

### Task 9: Couche de données et mode démo

**Files:**
- Create: `src/data/criteres.js`, `src/demo/criteres.js`
- Modify: `src/data/objets.js`, `src/data/hooks.js`, `src/demo/store.js`, `src/demo/objets.js`, `vite.demo.config.js`

**Interfaces:**
- Consumes : migration (Tasks 1 à 3).
- Produces :
  - `src/data/criteres.js` : `listerCriteres(): Promise<{id, famille, code, libelle, aide, ordre}[]>` (actifs, triés par `ordre`) ; `listerCatalogueAmenagements(): Promise<{chapitres, amenagements}>` (mêmes colonnes que `useCatalogue` d'AménagActif plus `actif`, **sans** filtre `actif`, triés par `ordre`) ; `definirCriteres(objetId: string, {critereIds, chapitreIds, amenagementIds}): Promise<void>` (appel RPC `logi_definir_criteres`, erreur relancée).
  - `src/data/hooks.js` : `useCriteres()` (clé `['criteres']`, `staleTime` 30 min) et `useCatalogueAmenagements()` (clé `['catalogue-amenagements']`, `staleTime` 5 min).
  - `src/data/objets.js` : `COLONNES` gagne `type_ressource, auteur, editeur, isbn, description, description_a_relire, autre_trouble, autre_difficulte, autre_amenagement, logi_objets_criteres(critere_id), logi_objets_amenagements(chapitre_id, amenagement_id)` ; `listerObjets` et `getObjetParCode` renvoient chaque objet avec en plus `critere_ids`, `chapitre_ids`, `amenagement_ids` (tableaux, jamais `undefined`) ; fonction exportée `normaliserLiens(objet)` qui calcule ces trois tableaux.
  - Démo : `src/demo/store.js` expose `criteres` (les 13 du jeu de départ), `chapitresAr`, `amenagementsAr` (3 chapitres dont un dispositif, une dizaine d'items dont un désactivé) ; `src/demo/criteres.js` implémente les trois fonctions sur ce magasin ; les objets de démonstration reçoivent `type_ressource`, quelques `critere_ids` / `chapitre_ids` / `amenagement_ids`, un objet numérique et un livre avec auteur, éditeur et ISBN ; `vite.demo.config.js` ajoute `criteres` aux deux expressions d'alias.
- Test: `tests/domain/liens-objet.test.js` pour `normaliserLiens`.

- [ ] **Step 1: Write the failing test.** `normaliserLiens({logi_objets_criteres: [{critere_id: 'k1'}], logi_objets_amenagements: [{chapitre_id: 'c1', amenagement_id: null}, {chapitre_id: null, amenagement_id: 'a1'}]})` ajoute `critere_ids: ['k1']`, `chapitre_ids: ['c1']`, `amenagement_ids: ['a1']` ; sans les clés d'entrée, les trois tableaux sont vides.
- [ ] **Step 2: Run** `npx vitest run tests/domain/liens-objet.test.js` — FAIL.
- [ ] **Step 3: Implement** `normaliserLiens` et les autres éléments de l'interface ; dans `tests/pages/pages.test.jsx`, ajouter le mock de `../../src/data/criteres.js` (`listerCriteres`, `listerCatalogueAmenagements`, `definirCriteres: vi.fn`) pour que les pages existantes continuent de se monter.
- [ ] **Step 4: Run** `npm test` — PASS (tous les tests existants inclus) puis `npm run demo` démarre sans erreur console (ouvrir `http://localhost:5181/?role=admin`).
- [ ] **Step 5: Commit** `feat(données): critères, catalogue AménagActif, liens normalisés, démo`.

---

### Task 10: Composants du bloc « Pour qui ? »

**Files:**
- Create: `src/components/ListeACocher.jsx`, `src/components/SelecteurAmenagements.jsx`, `src/components/PourQui.jsx`
- Modify: `src/logistecole.css` (classes `liste-deroulante`, `case-44`)
- Test: `tests/components/PourQui.test.jsx`

**Interfaces:**
- Consumes : Tasks 5 et 6.
- Produces :
  - `<ListeACocher id label aide options valeurs onChange autre onAutre sansAutre />` : `options = {value, label, aide?}[]`, `valeurs: string[]`, `autre = {coche, texte}`. Un bouton `aria-expanded` / `aria-controls` ouvre un panneau de cases (chaque ligne ≥ 44 px, texte ≥ 16 px) ; le bouton résume « Dyslexie, TDAH (2 cochés) » ou « Choisir… » ; la dernière ligne « Autre (préciser) » (absente si `sansAutre`) ouvre un champ texte avec label, placeholder concret et aide ; `maxLength` 500. Le texte d'aide de chaque option s'affiche sous son libellé.
  - `<SelecteurAmenagements catalogue selection onChange autre onAutre sansAutre />` : une ligne par chapitre avec case « chapitre entier », résumé « n sur m » ou « entier », bouton « voir le détail » qui déplie les items (étiquette AU / AR / Dispositif, mention « désactivé dans AménagActif » si `desactive`) ; cases des détails désactivées quand le chapitre est entier ; deux cases « AU » et « AR » (cochées par défaut) qui n'affichent que ces types, les items « Dispositif » restant visibles dès qu'un des deux est coché ; la sélection ne change pas quand on masque un type.
  - `<PourQui criteres catalogue valeur onChange chargement erreur sansAutre />` avec `valeur = {critereIds: string[], selection, autres}` ; trois blocs (Troubles, Difficultés d'apprentissage, Aménagements) ; `MENTION_INDICATIVE` visible ; si `erreur`, un message « Les listes n'ont pas pu être chargées : vous pouvez enregistrer la fiche sans toucher aux critères. » et aucun champ n'est modifiable ; si `chargement`, « Chargement des listes… ».

- [ ] **Step 1: Write the failing tests** (props en dur, sans données) : le panneau est fermé au départ et s'ouvre au clic ; cocher « Dyslexie » appelle `onChange(['k-dyslexie'])` ; cocher « Autre » affiche un champ texte, le décocher le retire ; chapitre entier coché : les cases de détail sont `disabled` et le résumé dit « entier » ; cocher un détail affiche « 1 sur 2 » ; décocher « AR » masque les items AR sans appeler `onChange` ; un item `desactive` porte la mention ; avec `erreur`, la mention indicative et le message sont présents et aucune case n'est rendue ; chaque `input` de case a un label accessible.
- [ ] **Step 2: Run** `npx vitest run tests/components/PourQui.test.jsx` — FAIL.
- [ ] **Step 3: Implement** les trois composants (pas de `select multiple`, pas d'accès aux données ; chaque état ouvert/fermé est local).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(ui): listes à cocher, sélecteur d'aménagements, bloc Pour qui`.

---

### Task 11: Formulaire d'objet

**Files:**
- Modify: `src/pages/FormulaireObjet.jsx`, `src/pages/FicheObjet.jsx` (affichage de `location.state?.avertissement`)
- Test: `tests/pages/pages.test.jsx`

**Interfaces:**
- Consumes : Tasks 5, 6, 9, 10.
- Produces : le formulaire gagne, avant « Photo » : liste de choix « Type de ressource » (`TYPES_RESSOURCE`), « Auteur », « Éditeur », « ISBN », « Description » (chacun avec `ChampGuide`, placeholder concret, aide qui dit ce que la saisie change : recherche et fiche), puis le bloc `PourQui`. État du bloc : `valeur` initialisée depuis `existant` en modification (`critere_ids`, sélection depuis `chapitre_ids` / `amenagement_ids`, `autresDepuisObjet`) ; drapeau `touche` mis à vrai au premier changement.
  - Validation à l'envoi (messages en français) : ISBN non vide et `normaliserIsbn` nul → erreur ; `validerAutres` en échec → erreurs jointes.
  - Valeurs envoyées en plus dans `commun` : `type_ressource`, `auteur`, `editeur` (chaînes `trim` ou `null`), `isbn` (13 chiffres normalisés ou `null`), `description`, `autre_trouble`, `autre_difficulte`, `autre_amenagement`.
  - Type `numerique` : la quantité vaut 1, `consommable` faux, `parent_id` nul, `etat` `bon` ; les blocs consommable, quantité, stock, état à l'arrivée, kit sont masqués ; l'emplacement reste facultatif.
  - Création : après `creerObjets`, `definirCriteres(objet_id, …)` est appelé pour chaque objet créé seulement si le bloc contient au moins un critère ou aménagement ; si cet appel échoue, la navigation a lieu quand même vers la fiche (ou vers les étiquettes pour un lot) avec `state: {avertissement: "L'objet a été créé mais les critères n'ont pas pu être enregistrés : ouvrez « Modifier la fiche » pour les ajouter."}`, jamais de nouvel envoi du formulaire.
  - Modification : `definirCriteres` n'est appelé que si `touche` est vrai **et** que le bloc est chargé (ni `chargement` ni `erreur`).

- [ ] **Step 1: Write the failing tests** (modèle de `pages.test.jsx`) : création d'un livre avec ISBN `2-7381-1974-3` envoie `isbn: '9782738119742'` à `creerObjets` ; ISBN `123` affiche l'erreur et n'appelle pas `creerObjets` ; « Autre » coché sans texte bloque l'envoi ; création avec un trouble coché appelle `definirCriteres` avec l'id du nouvel objet ; création sans aucun critère n'appelle pas `definirCriteres` ; échec de `definirCriteres` après création navigue quand même et la fiche affiche l'avertissement ; type `numerique` : le champ quantité n'existe pas et le payload a `consommable: false`, `parent_id: null` ; modification sans toucher au bloc n'appelle pas `definirCriteres` ; modification avec le catalogue en erreur (`listerCatalogueAmenagements` rejeté) enregistre la fiche et n'appelle pas `definirCriteres` ; un rôle `lecture` voit le refus déjà existant.
- [ ] **Step 2: Run** `npx vitest run tests/pages/pages.test.jsx` — FAIL.
- [ ] **Step 3: Implement.** Garder la structure actuelle de `soumettre` ; ajouter les étapes décrites ; ne pas dupliquer la logique de validation hors des modules de domaine.
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(ui): formulaire d'objet avec type, ISBN, description et Pour qui`.

---

### Task 12: Affichage sur la fiche

**Files:**
- Create: `src/components/fiche/BlocPourQui.jsx`
- Modify: `src/pages/FicheObjet.jsx`
- Test: `tests/pages/pages.test.jsx`

**Interfaces:**
- Consumes : Tasks 6, 9.
- Produces : `<BlocPourQui objet criteres catalogue />` (lecture seule, aucune action) : section « Pour qui ? » avec libellés des troubles et difficultés, chapitres entiers, aménagements précis (étiquette AU / AR / Dispositif ; un aménagement désactivé reste affiché), les trois textes « Autre » nommés par famille, et `MENTION_INDICATIVE` ; « Aucun critère posé. » quand tout est vide. Dans `FicheObjet`, la section principale affiche type de ressource, auteur, éditeur, ISBN, description (champs vides omis) ; pour un objet `numerique`, `BlocPret`, `BlocReservations`, `BlocKit`, `BlocStock` et le lien « Imprimer l'étiquette » ne sont pas rendus ; la fiche affiche `location.state?.avertissement` en `role="alert"`.

- [ ] **Step 1: Write the failing tests** : fiche d'un livre avec deux critères, un chapitre et un aménagement désactivé : tous les libellés et la mention sont présents ; fiche d'un objet ancien (sans `critere_ids`, `description` nulle) : « Aucun critère posé. », pas d'erreur d'exécution ; fiche numérique : pas de bouton de prêt ni de lien d'étiquette ; rôle `emprunteur` : le bloc est visible, aucun lien « Modifier la fiche ».
- [ ] **Step 2: Run** `npx vitest run tests/pages/pages.test.jsx` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(ui): critères et notice sur la fiche`.

---

### Task 13: Recherche de l'accueil

**Files:**
- Modify: `src/pages/Accueil.jsx`
- Test: `tests/pages/pages.test.jsx`

**Interfaces:**
- Consumes : Tasks 7, 9, 10.
- Produces : sous le champ de recherche, un sélecteur « Type » (Tous / Physique / Numérique) toujours visible ; un bouton `<details>` « Filtres » qui contient catégorie, emplacement, état (déplacés) et le bloc `PourQui` en mode filtre (`sansAutre`, valeur `{critereIds, selection}` traduite en `critereIds`, `chapitreIds`, `amenagementIds` pour `filtrerObjets`, avec `contexte` fourni par `useCriteres` et `chapitreDeAmenagement`) ; le texte d'aide de la recherche cite auteur, éditeur, ISBN ; la variable `filtre` (qui affiche aussi les éléments de kit) tient compte des nouveaux filtres ; un objet `numerique` affiche « Numérique » à la place de l'emplacement dans la liste. Si les listes ne se chargent pas, les filtres de critères sont absents et le reste de la page fonctionne.

- [ ] **Step 1: Write the failing tests** : choisir « Numérique » ne laisse que l'objet numérique ; cocher un trouble ne laisse que les objets liés ; deux familles = ET ; critères en erreur de chargement : la liste et la recherche texte fonctionnent ; recherche « 9782738119742 » trouve le livre.
- [ ] **Step 2: Run** `npx vitest run tests/pages/pages.test.jsx` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(ui): recherche par type, critères et aménagements`.

---

### Task 14: Vue administrateur des textes « Autre »

**Files:**
- Create: `src/pages/AdminAutres.jsx`
- Modify: `src/pages/Admin.jsx`
- Test: `tests/pages/pages.test.jsx`

**Interfaces:**
- Consumes : `useObjets`.
- Produces : onglet « Textes « Autre » » dans `ONGLETS` de `Admin.jsx` ; la page liste, par famille (Troubles, Difficultés, Aménagements), les objets dont `autre_*` est non vide : nom (lien vers `/o/<code>`) et texte ; une phrase d'aide dit que la promotion d'un texte en vraie case se fait par migration ; message « Aucun texte « Autre » pour l'instant. » quand tout est vide.

- [ ] **Step 1: Write the failing test** : deux objets avec `autre_trouble` et un avec `autre_aménagement`, la page regroupe par famille et lie vers les fiches ; liste vide → message.
- [ ] **Step 2: Run** `npx vitest run tests/pages/pages.test.jsx` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(ui): vue administrateur des textes « Autre »`.

---

### Task 15: Import : colonnes de la fiche

**Files:**
- Modify: `src/domain/import.js`
- Test: `tests/domain/import.test.js`

**Interfaces:**
- Produces : `analyserImport` reconnaît les en-têtes (après `normaliserNom`) `auteur` / `auteurs` ; `editeur` / `editeurs` / `maison d edition` ; `isbn` / `isbn13` / `isbn 13` / `isbn10` ; `description` / `resume` / `descriptif` ; `support` / `physique ou numerique` (valeurs `physique`, `numerique` ou `numérique`, `les deux` ; vide = `physique`). Chaque objet produit porte `auteur`, `editeur`, `isbn` (normalisé par `normaliserIsbn`), `description`, `type_ressource`. Erreurs par ligne en français : ISBN invalide, description > 2000, auteur ou éditeur > 200, support inconnu, quantité > 1 pour un support `numerique`. `MODELE_CSV` gagne les colonnes `auteur;éditeur;isbn;description;support` en fin de ligne. Le décodage du format Excel du logiciel d'origine n'est pas dans ce plan.

- [ ] **Step 1: Write the failing tests** : une ligne avec ISBN `2-7381-1974-3` donne `isbn: '9782738119742'` ; ISBN invalide → erreur sur le numéro de ligne, ligne non importée ; `support` = `Numérique` avec quantité 3 → erreur ; fichier sans les nouvelles colonnes → mêmes résultats qu'avant (tests existants inchangés, ajuster seulement l'attendu de `MODELE_CSV`).
- [ ] **Step 2: Run** `npx vitest run tests/domain/import.test.js tests/domain/import-fuseau.test.js` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(import): auteur, éditeur, ISBN, description, support`.

---

### Task 16: Recette, build, et application en production (accord de JF requis)

**Files:**
- Modify: `docs/recette.md` (nouvelle section « Fiche enrichie »)

- [ ] **Step 1: Build et suite complète.** `cd C:\Users\jfbeg\OneDrive\claude-workspace\logistecole` puis `npm test` (tous verts) et `npx vite build` (sans erreur). Noter le nombre de tests passés.
- [ ] **Step 2: Essai en démo.** `npm run demo`, ouvrir `http://localhost:5181/?role=admin` : créer un livre avec ISBN, cocher un trouble, un chapitre entier, un détail, « Autre » avec texte ; vérifier la fiche, puis la recherche par trouble, par chapitre, par « Numérique ». Ouvrir `?role=lecture` : fiche visible, aucun lien de modification. Noter constaté / non constaté pour chaque point.
- [ ] **Step 3: Rédiger la section de recette** de `docs/recette.md` : étapes numérotées avec chemins Windows absolus et URL exactes (`http://localhost:5180/` pour la vraie base, `http://localhost:5181/?role=admin` pour la démo), y compris : catalogue qui ne se charge pas (couper le réseau), aménagement désactivé dans AménagActif puis fiche rouverte, objet numérique non prêtable, un téléphone (cases à 44 px, liste qui s'ouvre sur toute la largeur).
- [ ] **Step 4: Demander l'accord de JF** pour appliquer la migration sur `dfoaumjleqtxjeaplnna`. Sans accord explicite, s'arrêter ici.
- [ ] **Step 5 (après accord): appliquer et vérifier.** Depuis la racine du projet : `npx --yes supabase@latest db query --remote=dfoaumjleqtxjeaplnna --yes -f supabase/migrations/20261019_logistecole_fiche_enrichie.sql`. Puis, en lecture seule (`--read-only -o table`), vérifier : 13 lignes dans `logi_criteres` ; `has_table_privilege('anon', 'public.logi_criteres', 'select')` faux ; `authenticated` sans `insert` sur `logi_objets_criteres` ; `logi_definir_criteres` non exécutable par `anon`. Rejouer `supabase/tests/logistecole_fiche.sql` sur la vraie base (script terminé par `rollback`, aucune trace) et vérifier la ligne de verdict.
- [ ] **Step 6: Commit** `docs(recette): fiche enrichie` ; mettre à jour la mémoire du projet (`logistecole-session-prompt.md`) avec l'état réel (appliqué ou non, tests, ce qui reste). Ne pas pousser sans accord de JF.
