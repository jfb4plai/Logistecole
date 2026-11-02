-- Tests Logistécole : achat, kits, prêts, retours, réservations, stock, pannes.
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
  ('a0000000-0000-0000-0000-000000000005', 'a-prof5@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', 'b-admin@test.invalid');

insert into logi_organisations (id, nom, type) values
  ('11111111-1111-1111-1111-111111111111', 'École A', 'ecole'),
  ('22222222-2222-2222-2222-222222222222', 'Pôle B', 'pole');

insert into logi_membres (user_id, org_id, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin', 'a-admin@test.invalid'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'gestionnaire', 'a-gest@test.invalid'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'lecture', 'a-lect@test.invalid'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'emprunteur', 'a-prof4@test.invalid'),
  ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'emprunteur', 'a-prof5@test.invalid'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin', 'b-admin@test.invalid');

-- Kit K (racine) avec trois tablettes, deux projecteurs, un consommable, un objet de l'autre organisation
insert into logi_objets (id, org_id, nom, code) values
  ('d0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Valise de tablettes', 'KKKK2222');
insert into logi_objets (id, org_id, nom, code, parent_id) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tablette 1', 'TTTT2224', 'd0000000-0000-0000-0000-00000000000a'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Tablette 2', 'TTTT2225', 'd0000000-0000-0000-0000-00000000000a'),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Tablette 3', 'TTTT2226', 'd0000000-0000-0000-0000-00000000000a');
insert into logi_objets (id, org_id, nom, code) values
  ('d0000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'Projecteur', 'PPPP2222'),
  ('d0000000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'Projecteur de réserve', 'QQQQ2222'),
  ('d0000000-0000-0000-0000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'Casque', 'RRRR2222');
insert into logi_objets (id, org_id, nom, code, consommable, quantite, seuil_min) values
  ('d0000000-0000-0000-0000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'Piles AA', 'CCCC2222', true, 10, 5);

-- ── Rôles et colonnes ──────────────────────────────────────────────────
do $t$ begin
  assert exists (select 1 from logi_membres where role = 'emprunteur'), 'le rôle emprunteur est accepté';
end $t$;
select zz_echec($$insert into logi_membres (user_id, org_id, role) values ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'roi')$$, array['23514']);

-- ── Achat : tracé dans l'historique ────────────────────────────────────
insert into logi_objets (id, org_id, nom, code, date_achat, fournisseur, prix_achat)
  values ('d0000000-0000-0000-0000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'Imprimante', 'JJJJ2222', date '2026-09-15', 'Fournisseur X', 129.90);
do $t$ begin
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000f1' and type = 'achat'), 'un événement achat est créé quand la date d''achat existe';
end $t$;
update logi_objets set fournisseur = 'Fournisseur Y' where id = 'd0000000-0000-0000-0000-0000000000f1';
do $t$ begin
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000f1' and type = 'modification' and commentaire = 'fournisseur' and avant = 'Fournisseur X' and apres = 'Fournisseur Y'), 'le changement de fournisseur est tracé';
end $t$;
select zz_echec($$update logi_objets set prix_achat = -1 where id = 'd0000000-0000-0000-0000-0000000000f1'$$, array['23514']);
select zz_echec($$update logi_objets set liens = '"pas un tableau"'::jsonb where id = 'd0000000-0000-0000-0000-0000000000f1'$$, array['23514']);
select zz_echec($$update logi_objets set liens = (select jsonb_agg(jsonb_build_object('titre','x','url','https://a.be')) from generate_series(1,11)) where id = 'd0000000-0000-0000-0000-0000000000f1'$$, array['23514']);
select zz_echec($$update logi_objets set liens = '[{"titre":"piège","url":"javascript:alert(1)"}]'::jsonb where id = 'd0000000-0000-0000-0000-0000000000f1'$$, array['23514']);
update logi_objets set liens = '[{"titre":"Mode d''emploi","url":"https://exemple.be/mode-emploi.pdf"}]'::jsonb where id = 'd0000000-0000-0000-0000-0000000000f1';

-- ── Kit : règles de cohérence ──────────────────────────────────────────
select zz_echec($$update logi_objets set parent_id = 'd0000000-0000-0000-0000-000000000001' where id = 'd0000000-0000-0000-0000-00000000000a'$$, array['P0001']);
select zz_echec($$update logi_objets set parent_id = id where id = 'd0000000-0000-0000-0000-0000000000b1'$$, array['P0001']);
select zz_echec($$update logi_objets set parent_id = 'd0000000-0000-0000-0000-0000000000c1' where id = 'd0000000-0000-0000-0000-0000000000b1'$$, array['P0001']);
select zz_echec($$update logi_objets set parent_id = 'd0000000-0000-0000-0000-0000000000b1' where id = 'd0000000-0000-0000-0000-00000000000a'$$, array['P0001']); -- K a des éléments : ne peut pas devenir élément
select zz_echec($$insert into logi_objets (org_id, nom, code, consommable) values ('11111111-1111-1111-1111-111111111111', 'Sans quantité', 'SSSS2222', true)$$, array['23514']);

-- ── Droits directs : aucune écriture dans prêts et réservations ────────
select zz_comme('a0000000-0000-0000-0000-000000000002');
select zz_echec($$insert into logi_prets (org_id, objet_id, emprunteur_id, echeance) values ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-0000000000b1', gen_random_uuid(), current_date + 3)$$, array['42501']);
select zz_echec($$update logi_prets set echeance = current_date$$, array['42501']);
select zz_echec($$delete from logi_prets$$, array['42501']);
select zz_echec($$insert into logi_reservations (org_id, objet_id, emprunteur_id, debut, fin) values ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-0000000000b1', gen_random_uuid(), now(), now() + interval '1 hour')$$, array['42501']);
reset role;

-- ── Emprunt par l'enseignant (kit) ─────────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ declare g uuid; begin
  g := logi_emprunter('d0000000-0000-0000-0000-00000000000a', current_date + 7);
  assert g is not null, 'logi_emprunter renvoie le groupe';
  assert (select count(*) from logi_prets where retour_le is null) = 4, 'le prêt du kit crée 4 lignes (racine + 3 tablettes)';
  assert (select count(distinct groupe_id) from logi_prets) = 1, 'un seul groupe';
  assert (select count(*) from logi_emprunteurs) = 1, 'l''enseignant ne voit que sa propre fiche emprunteur';
  assert (select compte_id from logi_emprunteurs) = 'a0000000-0000-0000-0000-000000000004', 'la fiche est liée à son compte';
  assert (select count(*) from logi_historique where type = 'pret' and commentaire like 'jusqu''au %') = 4, 'chaque prêt est tracé avec l''échéance';
end $t$;
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-000000000001', current_date + 7)$$, array['P0001'], 'kit');
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000e1', current_date + 7)$$, array['P0001'], 'consommable');
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000b1', current_date - 1)$$, array['P0001'], 'échéance');
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000b1', current_date + 400)$$, array['P0001'], 'échéance');
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000c1', current_date + 3)$$, array['42501', 'P0001']);
select zz_echec($$insert into logi_objets (org_id, nom, code) values ('11111111-1111-1111-1111-111111111111', 'Interdit', 'XXXX2222')$$, array['42501']);
reset role;

-- ── Isolation de lecture des prêts ─────────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000005');
do $t$ begin
  assert (select count(*) from logi_prets) = 0, 'un autre enseignant ne voit pas les prêts de son collègue';
  assert (select count(*) from logi_emprunteurs) = 0, 'ni sa fiche emprunteur';
  assert (select count(*) from logi_objets) >= 6, 'mais il voit le matériel';
end $t$;
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-00000000000a', current_date + 7)$$, array['P0001'], 'déjà prêté');
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000003');
do $t$ begin assert (select count(*) from logi_prets) = 4, 'le rôle lecture voit tous les prêts'; end $t$;
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000b1', current_date + 7)$$, array['42501']);
reset role;

select zz_comme('b0000000-0000-0000-0000-000000000001');
do $t$ begin assert (select count(*) from logi_prets) = 0, 'l''autre organisation ne voit rien'; end $t$;
select zz_echec($$select logi_preter('d0000000-0000-0000-0000-0000000000b1', gen_random_uuid(), current_date + 3)$$, array['42501']);
reset role;

-- ── Retour partiel du kit, puis retour avec état dégradé ───────────────
-- Les identifiants des prêts de l'enseignant 4, mémorisés hors RLS : l'enseignant 5 ne peut pas les rendre
select set_config('zz.ids', (select string_agg(id::text, ',') from logi_prets where retour_le is null), false);
select set_config('zz.un', (select id::text from logi_prets where retour_le is null limit 1), false);
select zz_comme('a0000000-0000-0000-0000-000000000005');
select zz_echec($$select logi_rendre(string_to_array(current_setting('zz.ids'), ',')::uuid[], 'bon')$$, array['42501'], 'propres prêts');
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  perform logi_rendre(array(select id from logi_prets where retour_le is null and objet_id in (
    'd0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')), 'bon', 'Rendu en salle des profs');
  assert (select count(*) from logi_prets where retour_le is null) = 1, 'il reste le prêt de la tablette 3';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-00000000000a' and type = 'retour_partiel' and commentaire like '%Tablette 3 (TTTT2226)%'), 'la racine note ce qui manque, avec le code qui distingue les exemplaires';
  assert (select count(*) from logi_historique where type = 'retour') = 3, 'trois retours tracés';
end $t$;
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000002');
do $t$ begin
  perform logi_rendre(array(select id from logi_prets where retour_le is null), 'defectueux', 'Écran fissuré');
  assert (select count(*) from logi_prets where retour_le is null) = 0, 'tout est rendu';
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-000000000003') = 'defectueux', 'l''état de l''objet suit le retour';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-000000000003' and type = 'etat' and apres = 'defectueux'), 'le changement d''état est tracé';
end $t$;
-- Reprêter le kit : la tablette 3 défectueuse est laissée de côté et la racine le note
do $t$ begin
  perform logi_preter('d0000000-0000-0000-0000-00000000000a', (select id from logi_emprunteurs limit 1), current_date + 5, 'Atelier de lundi');
  assert (select count(*) from logi_prets where retour_le is null) = 3, 'racine + 2 tablettes en état de marche';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-00000000000a' and type = 'pret' and commentaire like '%sans 1 élément%'), 'la racine mentionne l''élément laissé de côté';
end $t$;
reset role;

-- Prolongation : par le titulaire ou le gestionnaire, pas par un autre
select set_config('zz.un', (select id::text from logi_prets where retour_le is null limit 1), false);
select zz_comme('a0000000-0000-0000-0000-000000000005');
select zz_echec($$select logi_prolonger(current_setting('zz.un')::uuid, current_date + 20)$$, array['42501'], 'propres prêts');
reset role;
select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  perform logi_prolonger((select id from logi_prets where retour_le is null and objet_id = 'd0000000-0000-0000-0000-00000000000a'), current_date + 14);
end $t$;
reset role;
do $t$ begin
  assert (select count(*) from logi_prets where retour_le is null and echeance = current_date + 14) = 3, 'la prolongation s''applique à tout le groupe';
end $t$;

-- ── Unicité : un seul prêt ouvert par objet ────────────────────────────
select zz_echec($$insert into logi_prets (org_id, objet_id, emprunteur_id, echeance) select org_id, objet_id, emprunteur_id, echeance from logi_prets where retour_le is null limit 1$$, array['23505']);

-- ── Réservations ───────────────────────────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000005');
do $t$ declare r uuid; begin
  r := logi_reserver('d0000000-0000-0000-0000-0000000000b1', (current_date + 1) + time '10:00', (current_date + 1) + time '12:00');
  assert r is not null, 'réservation créée';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000b1' and type = 'reservation'), 'réservation tracée';
end $t$;
select zz_echec($$select logi_reserver('d0000000-0000-0000-0000-0000000000b1', (current_date + 1) + time '11:00', (current_date + 1) + time '13:00')$$, array['P0001'], 'déjà réservé');
select zz_echec($$select logi_reserver('d0000000-0000-0000-0000-0000000000b1', (current_date + 1) + time '12:00', (current_date + 1) + time '11:00')$$, array['P0001']);
select zz_echec($$select logi_reserver('d0000000-0000-0000-0000-000000000001', (current_date + 2) + time '08:00', (current_date + 2) + time '09:00')$$, array['P0001'], 'kit');
select zz_echec($$select logi_reserver('d0000000-0000-0000-0000-0000000000e1', (current_date + 2) + time '08:00', (current_date + 2) + time '09:00')$$, array['P0001'], 'consommable');
select logi_reserver('d0000000-0000-0000-0000-0000000000b1', (current_date + 1) + time '12:00', (current_date + 1) + time '13:00'); -- bout à bout : autorisé
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  assert (select count(*) from logi_reservations) = 2, 'l''enseignant voit le planning de l''organisation';
end $t$;
-- Emprunter le projecteur sur une période qui chevauche la réservation d'un autre : refusé
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000b1', current_date + 3)$$, array['P0001'], 'réservé');
select zz_echec($$select logi_annuler_reservation((select id from logi_reservations limit 1))$$, array['42501']);
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000005');
do $t$ begin
  perform logi_emprunter('d0000000-0000-0000-0000-0000000000b1', current_date + 3);
  assert (select count(*) from logi_reservations where statut = 'terminee') = 2, 'ses réservations sont converties en prêt';
end $t$;
reset role;

-- ── Panne et réparation ────────────────────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  perform logi_signaler('d0000000-0000-0000-0000-0000000000b2', 'Ne s''allume plus');
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000b2') = 'defectueux', 'le signalement passe l''objet en défectueux';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000b2' and type = 'panne' and commentaire = 'Ne s''allume plus'), 'la panne est tracée';
end $t$;
select zz_echec($$select logi_emprunter('d0000000-0000-0000-0000-0000000000b2', current_date + 3)$$, array['P0001'], 'hors service');
select zz_echec($$select logi_reparer('d0000000-0000-0000-0000-0000000000b2', 'bricolage')$$, array['42501']);
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000001');
select zz_echec($$select logi_signaler('d0000000-0000-0000-0000-0000000000c1', 'x')$$, array['42501']);
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000002');
do $t$ begin
  perform logi_reparer('d0000000-0000-0000-0000-0000000000b2', 'Câble remplacé');
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000b2') = 'bon', 'la réparation remet l''objet en bon état';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000b2' and type = 'reparation'), 'la réparation est tracée';
end $t$;

-- ── Stock ──────────────────────────────────────────────────────────────
do $t$ declare q int; begin
  q := logi_ajuster_stock('d0000000-0000-0000-0000-0000000000e1', -3, 'Rentrée');
  assert q = 7, 'nouvelle quantité renvoyée';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000e1' and type = 'stock' and avant = '10' and apres = '7' and commentaire = 'Rentrée'), 'mouvement de stock tracé';
end $t$;
select zz_echec($$select logi_ajuster_stock('d0000000-0000-0000-0000-0000000000e1', -8, 'trop')$$, array['P0001'], 'stock');
select zz_echec($$select logi_ajuster_stock('d0000000-0000-0000-0000-0000000000b1', 1, 'pas un consommable')$$, array['P0001'], 'consommable');
update logi_objets set quantite = 4 where id = 'd0000000-0000-0000-0000-0000000000e1';
do $t$ begin
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000e1' and type = 'stock' and avant = '7' and apres = '4'), 'une modification directe de la quantité est aussi tracée';
end $t$;
reset role;

select zz_comme('a0000000-0000-0000-0000-000000000004');
select zz_echec($$select logi_ajuster_stock('d0000000-0000-0000-0000-0000000000e1', 1, 'x')$$, array['42501']);
reset role;

-- ── Création en lot avec achat et liens ────────────────────────────────
select zz_comme('a0000000-0000-0000-0000-000000000002');
do $t$ declare n int; begin
  select count(*) into n from logi_creer_objets('11111111-1111-1111-1111-111111111111',
    '[{"nom":"Micro 1","code":"MMMM2224","date_achat":"2026-09-01","fournisseur":"Audio SA","prix_achat":49.5,"garantie_fin":"2028-09-01","liens":[{"titre":"Notice","url":"https://exemple.be/n.pdf"}]},
      {"nom":"Micro 2","code":"MMMM2222","date_achat":"2026-09-01","fournisseur":"Audio SA","prix_achat":49.5}]'::jsonb);
  assert n = 2, 'lot de 2 avec champs d''achat';
  assert (select count(*) from logi_historique where type = 'achat' and objet_id in (select id from logi_objets where code like 'MMMM%')) = 2, 'deux événements achat';
  assert (select liens -> 0 ->> 'titre' from logi_objets where code = 'MMMM2224') = 'Notice', 'les liens sont enregistrés';
end $t$;
reset role;

-- ── Lecture des prêts en cours pour le suivi ───────────────────────────
do $t$ begin
  assert (select count(*) from logi_prets where retour_le is null and org_id = '11111111-1111-1111-1111-111111111111') = 4, 'quatre prêts ouverts à ce stade : racine + 2 tablettes + projecteur';
end $t$;

-- ── Revue finale : l'historique d'une réservation écrit l'heure belge, pas l'heure UTC ──
select zz_comme('a0000000-0000-0000-0000-000000000002');
select logi_reserver('d0000000-0000-0000-0000-0000000000f1', timestamptz '2099-01-02 09:00+00', timestamptz '2099-01-02 10:30+00');
do $t$ begin
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000f1' and type = 'reservation'
                 and commentaire = 'du 02/01/2099 10:00 au 02/01/2099 11:30'), 'l''historique de réservation affiche l''heure de Bruxelles (UTC+1 en hiver)';
end $t$;
reset role;

-- ── Revue finale : droits d'exécution et colonne compte_id protégée ─────
do $t$ begin
  assert not has_function_privilege('anon', 'logi_trace_objet()', 'execute'), 'la fonction de trace n''est pas exécutable par anon';
  assert not has_function_privilege('authenticated', 'logi_trace_objet()', 'execute'), 'ni par authenticated';
  assert not has_function_privilege('authenticated', 'logi_avant_ecriture()', 'execute'), 'la fonction de cohérence n''est pas exécutable par authenticated';
  assert not has_function_privilege('authenticated', 'logi_garder_un_admin()', 'execute'), 'la garde du dernier admin n''est pas exécutable par authenticated';
  assert not has_function_privilege('authenticated', 'logi_creer_pret(uuid,uuid,date,text)', 'execute'), 'la création interne d''un prêt n''est pas exécutable';
  assert not has_function_privilege('authenticated', 'logi_emprunteur_moi(uuid)', 'execute'), 'la fiche emprunteur interne n''est pas exécutable';
  assert not has_function_privilege('anon', 'logi_emprunter(uuid,date,text)', 'execute'), 'anon ne peut pas emprunter';
  assert has_function_privilege('authenticated', 'logi_emprunter(uuid,date,text)', 'execute'), 'authenticated peut appeler logi_emprunter';
end $t$;

select zz_comme('a0000000-0000-0000-0000-000000000002');
select zz_echec($$update logi_emprunteurs set compte_id = 'b0000000-0000-0000-0000-000000000001'$$, array['42501']);
select zz_echec($$insert into logi_emprunteurs (org_id, type, libelle, compte_id) values ('11111111-1111-1111-1111-111111111111', 'enseignant', 'X', 'b0000000-0000-0000-0000-000000000001')$$, array['42501']);
insert into logi_emprunteurs (org_id, type, libelle) values ('11111111-1111-1111-1111-111111111111', 'eleve', 'E99');
do $t$ begin
  assert zz_lignes($$update logi_emprunteurs set libelle = 'E100' where libelle = 'E99'$$) = 1, 'le libellé reste modifiable par un gestionnaire';
end $t$;
reset role;

-- ── État « neuf » : accepté, prêtable, réservable, jamais déclarable au retour ──
insert into logi_objets (id, org_id, nom, code, etat) values
  ('d0000000-0000-0000-0000-0000000000f2', '11111111-1111-1111-1111-111111111111', 'Tablette neuve', 'NNNN2222', 'neuf'),
  ('d0000000-0000-0000-0000-0000000000f3', '11111111-1111-1111-1111-111111111111', 'Casque neuf', 'NNNN3333', 'neuf');
select zz_comme('a0000000-0000-0000-0000-000000000004');
do $t$ begin
  perform logi_emprunter('d0000000-0000-0000-0000-0000000000f2', current_date + 3);
  assert exists (select 1 from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f2' and retour_le is null), 'un objet neuf se prête';
  perform logi_reserver('d0000000-0000-0000-0000-0000000000f3', (current_date + 20) + time '10:00', (current_date + 20) + time '11:00');
  assert exists (select 1 from logi_reservations where objet_id = 'd0000000-0000-0000-0000-0000000000f3'), 'un objet neuf se réserve';
  perform logi_signaler('d0000000-0000-0000-0000-0000000000f3', 'Haut-parleur muet');
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000f3') = 'defectueux', 'un objet neuf peut être signalé défectueux';
end $t$;
-- Au retour : un objet neuf peut revenir neuf (état conservé), mais aucun objet ne s'améliore
do $t$ begin
  perform logi_rendre(array(select id from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f2' and retour_le is null), 'neuf', 'jamais déballée');
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000f2') = 'neuf', 'un objet neuf rendu neuf reste neuf';
  assert exists (select 1 from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f2' and etat_retour = 'neuf'), 'le retour « neuf » est enregistré';
  assert exists (select 1 from logi_historique where objet_id = 'd0000000-0000-0000-0000-0000000000f2' and type = 'retour' and apres = 'neuf'), 'le retour « neuf » est tracé';
  perform logi_emprunter('d0000000-0000-0000-0000-0000000000f2', current_date + 3);
  perform logi_rendre(array(select id from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f2' and retour_le is null), 'bon');
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000f2') = 'bon', 'un objet neuf rendu « bon » est déclassé en « bon »';
end $t$;
reset role;
insert into logi_objets (id, org_id, nom, code, etat) values ('d0000000-0000-0000-0000-0000000000f4', '11111111-1111-1111-1111-111111111111', 'Casque 2', 'NNNN4444', 'bon');
select zz_comme('a0000000-0000-0000-0000-000000000004');
select logi_emprunter('d0000000-0000-0000-0000-0000000000f4', current_date + 3);
select zz_echec($$select logi_rendre(array(select id from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f4' and retour_le is null), 'neuf')$$, array['P0001'], 'améliore');
do $t$ begin
  assert (select etat from logi_objets where id = 'd0000000-0000-0000-0000-0000000000f4') = 'bon', 'le refus ne change rien';
  assert exists (select 1 from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f4' and retour_le is null), 'le prêt reste ouvert après un retour refusé';
end $t$;
select zz_echec($$select logi_rendre(array(select id from logi_prets where objet_id = 'd0000000-0000-0000-0000-0000000000f4' and retour_le is null), 'excellent')$$, array['P0001'], 'invalide');
reset role;

select 'LOGISTECOLE PRETS : tous les tests passent' as resultat;
rollback;
