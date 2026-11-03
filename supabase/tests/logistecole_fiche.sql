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

-- FIN DES TESTS
rollback;
select 'LOGISTECOLE FICHE : tous les tests passent';
