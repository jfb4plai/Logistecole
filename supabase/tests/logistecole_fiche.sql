-- Tests Logistécole : fiche enrichie (colonnes, ISBN, critères, aménagements, objets numériques).
-- Se termine par ROLLBACK : aucune donnée ne reste. Une assertion qui échoue arrête le script.
begin;

create function public.zz_echec(p_sql text, p_attendus text[], p_fragment text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = any (p_attendus) and (p_fragment is null or sqlerrm ilike '%' || p_fragment || '%') then return; end if;
    raise exception 'sqlstate % (%) au lieu de % [%] pour : %', sqlstate, sqlerrm, p_attendus, p_fragment, p_sql;
  end;
  raise exception 'aurait dû échouer : %', p_sql;
end $$;

create function public.zz_lignes(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.zz_comme(u uuid) returns void language plpgsql as $$
declare v_email text;
begin
  execute 'reset role';
  select email into v_email from auth.users where id = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'email', v_email)::text, true);
  execute 'set local role authenticated';
end $$;

-- ── Données de départ (rôle propriétaire) ──────────────────────────────
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', 'a-lect@test.invalid'),
  ('a0000000-0000-0000-0000-000000000004', 'a-prof4@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', 'b-admin@test.invalid');

insert into logi_organisations (id, nom, type) values
  ('11111111-1111-1111-1111-111111111111', 'École A', 'ecole'),
  ('22222222-2222-2222-2222-222222222222', 'Pôle B', 'pole');

insert into logi_membres (user_id, org_id, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'gestionnaire', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'lecture', 'a-lect@test.invalid'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'emprunteur', 'a-prof4@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin', 'b-admin@test.invalid');

insert into logi_objets (id, org_id, nom, code) values
  ('d0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Livre A1', 'FFFF2222'),
  ('d0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'Livre B1', 'GGGG2222');

-- ── ISBN : contrôle de clé ─────────────────────────────────────────────
do $t$ begin
  assert logi_isbn_valide('9782738119742'), 'ISBN-13 valide';
  assert logi_isbn_valide('2738119743'), 'ISBN-10 valide';
  assert logi_isbn_valide('9782808113069'), 'ISBN-13 valide (2)';
  assert logi_isbn_valide('2808113064'), 'ISBN-10 valide (2)';
  assert not logi_isbn_valide('9782738119743'), 'ISBN-13 à mauvaise clé refusé';
  assert not logi_isbn_valide('273811974'), 'neuf chiffres refusé';
  assert not logi_isbn_valide('abc'), 'lettres refusées';
  assert not logi_isbn_valide(''), 'vide refusé';
end $t$;

-- ── Contraintes des colonnes de la fiche ───────────────────────────────
select zz_echec($q$update logi_objets set isbn = '9782738119743' where code = 'FFFF2222'$q$, array['23514']);
select zz_echec($q$update logi_objets set type_ressource = 'autre' where code = 'FFFF2222'$q$, array['23514']);
select zz_echec($q$update logi_objets set description = repeat('x', 2001) where code = 'FFFF2222'$q$, array['23514']);
select zz_echec($q$update logi_objets set autre_trouble = '   ' where code = 'FFFF2222'$q$, array['23514']);
select zz_echec($q$update logi_objets set autre_trouble = repeat('x', 501) where code = 'FFFF2222'$q$, array['23514']);
select zz_echec($q$update logi_objets set auteur = repeat('x', 201) where code = 'FFFF2222'$q$, array['23514']);
do $t$ begin
  update logi_objets set isbn = '9782738119742', auteur = 'S. Dehaene', description_a_relire = true where code = 'FFFF2222';
  assert (select type_ressource from logi_objets where code = 'FFFF2222') = 'physique', 'type par défaut : physique';
end $t$;

-- ── Création en lot avec les nouvelles colonnes ────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000002');
do $t$
declare r record;
begin
  select * into r from logi_creer_objets(
    '11111111-1111-1111-1111-111111111111',
    '[{"nom":"Site de lecture","code":"HHHH2222","type_ressource":"numerique","auteur":"A. Auteur","isbn":"9782738119742","description":"Texte"},
      {"nom":"Jeu simple","code":"JJJJ2222"}]'::jsonb);
end $t$;
reset role;
do $t$ begin
  assert (select type_ressource from logi_objets where code = 'HHHH2222') = 'numerique', 'type numérique enregistré';
  assert (select auteur from logi_objets where code = 'HHHH2222') = 'A. Auteur', 'auteur enregistré';
  assert (select isbn from logi_objets where code = 'HHHH2222') = '9782738119742', 'ISBN enregistré';
  assert (select description from logi_objets where code = 'HHHH2222') = 'Texte', 'description enregistrée';
  assert (select type_ressource from logi_objets where code = 'JJJJ2222') = 'physique', 'type absent du JSON : physique';
end $t$;

-- ── Critères : liste de départ, droits ─────────────────────────────────
insert into ar_chapitres (id, ordre, titre, est_dispositif) values
  ('c1000000-0000-0000-0000-000000000001', 1, '1. SUPPORTS ET DOCUMENTS ÉCRITS', false),
  ('c1000000-0000-0000-0000-000000000002', 2, 'Dispositif de régulation des comportements', true);
insert into ar_amenagements (id, chapitre_id, ordre, libelle, type, actif) values
  ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, 'Police lisible', 'AU', true),
  ('e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 2, 'Temps supplémentaire', 'AR', true),
  ('e1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 3, 'Ancien aménagement', 'AR', false),
  ('e1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 1, 'Contrat de comportement', 'AR', true);

do $t$ begin
  assert (select count(*) from logi_criteres) = 13, '13 critères au départ';
  assert (select count(*) from logi_criteres where famille = 'trouble') = 7, '7 troubles';
  assert (select count(*) from logi_criteres where famille = 'difficulte') = 6, '6 difficultés';
  assert (select aide from logi_criteres where code = 'tdah') like '%TDAH%', 'aide du TDAH';
end $t$;

select zz_comme('a0000000-0000-0000-0000-000000000002');
select zz_echec($q$insert into logi_criteres (famille, code, libelle, ordre) values ('trouble', 'x', 'X', 99)$q$, array['42501']);
select zz_echec($q$insert into logi_objets_criteres (objet_id, critere_id) select 'd0000000-0000-0000-0000-0000000000a1', id from logi_criteres limit 1$q$, array['42501']);
select zz_echec($q$insert into logi_objets_amenagements (objet_id, chapitre_id) values ('d0000000-0000-0000-0000-0000000000a1', 'c1000000-0000-0000-0000-000000000001')$q$, array['42501']);
reset role;
set local role anon;
select zz_echec('select * from logi_criteres', array['42501']);
select zz_echec('select * from logi_objets_criteres', array['42501']);
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', '{}')$q$, array['42501']);
reset role;

-- ── logi_definir_criteres ──────────────────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000002');
select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1',
  array[(select id from logi_criteres where code = 'dyslexie')], '{}', array['e1000000-0000-0000-0000-000000000001'::uuid]);
reset role;
do $t$ begin
  assert (select count(*) from logi_objets_criteres where objet_id = 'd0000000-0000-0000-0000-0000000000a1') = 1, 'un critère posé';
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1') = 1, 'un aménagement posé';
  assert (select count(*) from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000a1' and commentaire = 'critères') = 1, 'une ligne d''historique';
  assert (select auteur_email from logi_historique where commentaire = 'critères') = 'a-gest@test.invalid', 'auteur de la pose';
end $t$;

select zz_comme('a0000000-0000-0000-0000-000000000002');
select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1',
  array[(select id from logi_criteres where code = 'dyslexie')], '{}', array['e1000000-0000-0000-0000-000000000001'::uuid]);
reset role;
do $t$ begin
  assert (select count(*) from logi_historique where commentaire = 'critères') = 1, 'rien de changé : pas de nouvelle ligne';
end $t$;

-- chapitre entier + détail du même chapitre : seul le chapitre est conservé
select zz_comme('a0000000-0000-0000-0000-000000000002');
select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}',
  array['c1000000-0000-0000-0000-000000000001'::uuid], array['e1000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000004'::uuid]);
reset role;
do $t$ begin
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1' and chapitre_id is not null) = 1, 'chapitre entier stocké';
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1' and amenagement_id = 'e1000000-0000-0000-0000-000000000001') = 0, 'détail du chapitre entier non stocké';
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1' and amenagement_id = 'e1000000-0000-0000-0000-000000000004') = 1, 'détail d''un autre chapitre conservé';
  assert (select count(*) from logi_objets_criteres where objet_id = 'd0000000-0000-0000-0000-0000000000a1') = 0, 'critères remplacés';
end $t$;

-- rôles refusés
select zz_comme('a0000000-0000-0000-0000-000000000003');
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', '{}')$q$, array['42501']);
select zz_comme('a0000000-0000-0000-0000-000000000004');
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', '{}')$q$, array['42501']);
select zz_comme('b0000000-0000-0000-0000-000000000001');
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', '{}')$q$, array['42501']);
select zz_comme('a0000000-0000-0000-0000-000000000002');
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000b1', '{}', '{}', '{}')$q$, array['42501']);
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000ff', '{}', '{}', '{}')$q$, array['42501']);
reset role;

-- désactivés : refusés s'ils ne sont pas déjà liés, conservés sinon
update logi_criteres set actif = false where code = 'tsa';
select zz_comme('a0000000-0000-0000-0000-000000000002');
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', array[(select id from logi_criteres where code = 'tsa')], '{}', '{}')$q$, array['23514']);
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', array['e1000000-0000-0000-0000-000000000003'::uuid])$q$, array['23514']);
select zz_echec($q$select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}', array['e1000000-0000-0000-0000-0000000000ee'::uuid])$q$, array['23503']);
reset role;
insert into logi_objets_amenagements (objet_id, amenagement_id) values ('d0000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-000000000003');
select zz_comme('a0000000-0000-0000-0000-000000000002');
select logi_definir_criteres('d0000000-0000-0000-0000-0000000000a1', '{}', '{}',
  array['e1000000-0000-0000-0000-000000000003'::uuid, 'e1000000-0000-0000-0000-000000000004'::uuid]);
reset role;
do $t$ begin
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1' and amenagement_id = 'e1000000-0000-0000-0000-000000000003') = 1, 'aménagement désactivé déjà lié conservé';
end $t$;

-- lecture par un enseignant : seulement les liens de son organisation
insert into logi_objets_criteres (objet_id, critere_id)
  values ('d0000000-0000-0000-0000-0000000000b1', (select id from logi_criteres where code = 'dyslexie'));
select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  assert (select count(*) from logi_objets_amenagements where objet_id = 'd0000000-0000-0000-0000-0000000000a1') > 0, 'l''enseignant voit les liens de son organisation';
  assert (select count(*) from logi_objets_criteres where objet_id = 'd0000000-0000-0000-0000-0000000000b1') = 0, 'l''enseignant ne voit pas ceux d''une autre organisation';
end $t$;
reset role;

-- suppression dans AménagActif : la liaison disparaît
delete from ar_amenagements where id = 'e1000000-0000-0000-0000-000000000003';
do $t$ begin
  assert (select count(*) from logi_objets_amenagements where amenagement_id = 'e1000000-0000-0000-0000-000000000003') = 0, 'cascade à la suppression d''un aménagement';
end $t$;

-- trace des champs « Autre »
update logi_objets set autre_trouble = 'élèves allophones' where code = 'FFFF2222';
do $t$ begin
  assert (select count(*) from logi_historique where commentaire = 'autre trouble') = 1, 'modification de « autre trouble » tracée';
end $t$;

-- FIN DES TESTS
rollback;
select 'LOGISTECOLE FICHE : tous les tests passent';
