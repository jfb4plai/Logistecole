-- Tests RLS Logistécole. Le script se termine par ROLLBACK : aucune donnée ne reste.
-- Une assertion qui échoue arrête le script avec un message explicite.
begin;

-- Assistants (créés dans la transaction, annulés à la fin)
create function public.zz_echec(p_sql text, p_attendus text[]) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = any (p_attendus) then return; end if;
    raise exception 'sqlstate % (%) au lieu de % pour : %', sqlstate, sqlerrm, p_attendus, p_sql;
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

-- Données de départ (rôle propriétaire)
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', 'a-lect@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', 'b-admin@test.invalid');

insert into logi_organisations (id, nom, type) values
  ('11111111-1111-1111-1111-111111111111', 'École A', 'ecole'),
  ('22222222-2222-2222-2222-222222222222', 'Pôle B', 'pole');

insert into logi_membres (user_id, org_id, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'gestionnaire', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'lecture', 'a-lect@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin', 'b-admin@test.invalid');

insert into logi_categories (id, org_id, nom) values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Tablettes'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Casques');

insert into logi_objets (id, org_id, nom, categorie_id, code) values
  ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Valise tablettes', 'c1111111-1111-1111-1111-111111111111', 'AAAA2222'),
  ('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Casque anti-bruit', 'c2222222-2222-2222-2222-222222222222', 'BBBB3333');

-- ── Admin de A ─────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","email":"a-admin@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_organisations) = 1, 'admin A ne voit que son organisation';
  assert (select count(*) from logi_objets) = 1, 'admin A ne voit que les objets de A';
  assert (select count(*) from logi_membres) = 3, 'admin A voit les 3 membres de A';
  assert (select count(*) from logi_categories) = 1, 'admin A ne voit que les catégories de A';
end $t$;

select zz_echec($$insert into logi_objets (org_id, nom, code) values ('22222222-2222-2222-2222-222222222222', 'Intrus', 'CCCC4444')$$, array['42501']);
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Doublon', 'AAAA2222')$$, array['23505']);
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Code invalide', 'abc')$$, array['23514']);
-- catégorie d'une autre organisation : refusée par le trigger
select zz_echec($$insert into logi_objets (org_id, nom, categorie_id, code) values ('11111111-1111-1111-1111-111111111111', 'Mélange', 'c2222222-2222-2222-2222-222222222222', 'DDDD5555')$$, array['P0001']);

-- Lot : 101 refusé, 2 acceptés avec traces de création
select zz_echec($$select * from logi_creer_objets('11111111-1111-1111-1111-111111111111', (select jsonb_agg(jsonb_build_object('nom', 'x', 'code', 'ZZ' || lpad(g::text, 6, '2')) ) from generate_series(1, 101) g))$$, array['P0001']);
select zz_echec($$select * from logi_creer_objets('11111111-1111-1111-1111-111111111111', '[]'::jsonb)$$, array['P0001']);
do $t$ declare n int; begin
  select count(*) into n from logi_creer_objets('11111111-1111-1111-1111-111111111111',
    '[{"nom":"Tablette 1","code":"EEEE2222"},{"nom":"Tablette 2","code":"EEEE3333"}]'::jsonb);
  assert n = 2, 'le lot de 2 doit créer 2 objets';
  assert (select count(*) from logi_historique where type = 'creation' and apres like 'Tablette %') = 2, 'chaque création est tracée';
end $t$;

-- Trace d'une modification, avec l'auteur
update logi_objets set nom = 'Valise de 16 tablettes' where id = 'd1111111-1111-1111-1111-111111111111';
do $t$ begin
  assert exists (
    select 1 from logi_historique
    where objet_id = 'd1111111-1111-1111-1111-111111111111' and type = 'modification' and commentaire = 'nom'
      and avant = 'Valise tablettes' and apres = 'Valise de 16 tablettes'
      and auteur = 'a0000000-0000-0000-0000-000000000001' and auteur_email = 'a-admin@test.invalid'
  ), 'la modification du nom est tracée avec auteur et valeurs';
end $t$;

-- Changement d'organisation interdit
select zz_echec($$update logi_objets set org_id = '22222222-2222-2222-2222-222222222222' where id = 'd1111111-1111-1111-1111-111111111111'$$, array['P0001', '42501']);

-- Historique : jamais update ni delete, même pour un admin
select zz_echec($$update logi_historique set commentaire = 'falsifié'$$, array['42501']);
select zz_echec($$delete from logi_historique$$, array['42501']);
-- Corrections et notes autorisées ; autres types refusés ; objet d'une autre org refusé
insert into logi_historique (objet_id, org_id, type, commentaire)
  values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'correction', 'La salle est la 21');
select zz_echec($$insert into logi_historique (objet_id, org_id, type) values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'deplacement')$$, array['42501']);
select zz_echec($$insert into logi_historique (objet_id, org_id, type, commentaire) values ('d2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'note', 'x')$$, array['42501']);

-- Emplacement parent d'une autre organisation refusé
do $t$ begin
  insert into logi_emplacements (id, org_id, nom) values ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Bâtiment principal');
end $t$;
select zz_echec($$insert into logi_emplacements (org_id, parent_id, nom) values ('22222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Intrus')$$, array['P0001', '42501']);

-- Dernier admin protégé
select zz_echec($$delete from logi_membres where user_id = 'a0000000-0000-0000-0000-000000000001'$$, array['P0001']);
select zz_echec($$update logi_membres set role = 'lecture' where user_id = 'a0000000-0000-0000-0000-000000000001'$$, array['P0001']);

reset role;

-- ── Gestionnaire de A ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated","email":"a-gest@test.invalid"}', true);
set local role authenticated;

insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Projecteur', 'FFFF2222');
do $t$ begin
  assert zz_lignes($$delete from logi_objets where code = 'FFFF2222'$$) = 0, 'un gestionnaire ne peut pas supprimer un objet';
  assert zz_lignes($$update logi_objets set etat = 'use' where code = 'FFFF2222'$$) = 1, 'un gestionnaire peut modifier un objet';
  assert exists (select 1 from logi_historique where type = 'etat' and avant = 'bon' and apres = 'use'), 'le changement d''état est tracé';
end $t$;
select zz_echec($$insert into logi_emplacements (org_id, nom) values ('11111111-1111-1111-1111-111111111111', 'Salle 12')$$, array['42501']);
select zz_echec($$insert into logi_categories (org_id, nom) values ('11111111-1111-1111-1111-111111111111', 'Autre chose')$$, array['42501']);
do $t$ begin
  assert zz_lignes($$update logi_membres set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000003'$$) = 0, 'un gestionnaire ne change pas les rôles';
end $t$;

reset role;

-- ── Lecture seule de A ─────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","email":"a-lect@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_objets) >= 1, 'le rôle lecture voit les objets';
end $t$;
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Interdit', 'GGGG2222')$$, array['42501']);
do $t$ begin
  assert zz_lignes($$update logi_objets set nom = 'Modifié' where code = 'AAAA2222'$$) = 0, 'le rôle lecture ne modifie rien';
end $t$;
select zz_echec($$insert into logi_historique (objet_id, org_id, type, commentaire) values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'note', 'x')$$, array['42501']);

reset role;

-- ── Admin de B : isolation inverse ─────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated","email":"b-admin@test.invalid"}', true);
set local role authenticated;

do $t$ begin
  assert (select count(*) from logi_objets) = 1, 'admin B ne voit que les objets de B';
  assert (select count(*) from logi_historique where org_id = '11111111-1111-1111-1111-111111111111') = 0, 'admin B ne voit pas l''historique de A';
  assert zz_lignes($$update logi_objets set nom = 'Piraté' where id = 'd1111111-1111-1111-1111-111111111111'$$) = 0, 'admin B ne modifie pas un objet de A';
  assert zz_lignes($$delete from logi_objets where id = 'd1111111-1111-1111-1111-111111111111'$$) = 0, 'admin B ne supprime pas un objet de A';
end $t$;

reset role;

-- ── Anonyme : aucun accès ──────────────────────────────────────────────
set local role anon;
select zz_echec($$select * from logi_objets$$, array['42501']);
select zz_echec($$select * from logi_organisations$$, array['42501']);
reset role;

-- ── Admin de A supprime un objet (autorisé) ────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","email":"a-admin@test.invalid"}', true);
set local role authenticated;
do $t$ begin
  assert zz_lignes($$delete from logi_objets where code = 'FFFF2222'$$) = 1, 'un admin peut supprimer un objet';
end $t$;
reset role;

-- ── Création d'une organisation par la fonction d'administration ───────
do $t$ declare v uuid; begin
  v := logi_nouvelle_organisation('École test', 'ecole', 'a0000000-0000-0000-0000-000000000002');
  assert (select count(*) from logi_categories where org_id = v) = 8, '8 catégories de départ';
  assert (select role from logi_membres where org_id = v) = 'admin', 'l''admin est créé';
end $t$;

select 'LOGISTECOLE RLS : tous les tests passent' as resultat;
rollback;
