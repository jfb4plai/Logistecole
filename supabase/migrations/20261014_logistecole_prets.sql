-- Logistécole — suite du socle : achat, liens, kits, prêts, retours, réservations, stock, pannes.
-- Toute écriture sur prêts et réservations passe par des fonctions qui contrôlent le rôle.
begin;

-- ── Rôle « emprunteur » (enseignant avec compte) ───────────────────────
alter table logi_membres drop constraint logi_membres_role_check;
alter table logi_membres add constraint logi_membres_role_check
  check (role in ('admin', 'gestionnaire', 'lecture', 'emprunteur'));

-- ── Objets : achat, liens utiles, kit, consommables ────────────────────
create or replace function logi_liens_valides(p jsonb) returns boolean
language sql immutable as $$
  select case
    when jsonb_typeof(p) <> 'array' then false
    else jsonb_array_length(p) <= 10 and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e ->> 'url', '') !~* '^https?://[^[:space:]]+$'
         or length(coalesce(e ->> 'url', '')) > 500
         or length(coalesce(e ->> 'titre', '')) > 120
    )
  end;
$$;

alter table logi_objets
  add column date_achat date,
  add column fournisseur text check (fournisseur is null or length(fournisseur) <= 120),
  add column prix_achat numeric(10, 2) check (prix_achat is null or prix_achat >= 0),
  add column garantie_fin date,
  add column numero_serie text check (numero_serie is null or length(numero_serie) <= 80),
  add column facture_url text check (facture_url is null or (length(facture_url) <= 500 and facture_url ~* '^https?://[^[:space:]]+$')),
  add column facture_photo_path text,
  add column financement text check (financement is null or length(financement) <= 120),
  add column liens jsonb not null default '[]'::jsonb check (logi_liens_valides(liens)),
  add column parent_id uuid references logi_objets(id) on delete restrict,
  add column consommable boolean not null default false,
  add column quantite integer check (quantite is null or quantite >= 0),
  add column seuil_min integer check (seuil_min is null or seuil_min >= 0),
  add constraint logi_objets_consommable_quantite check (not consommable or quantite is not null);
create index logi_objets_parent on logi_objets (parent_id);

-- ── Historique : nouveaux types d'événements (toujours sans update ni delete) ──
alter table logi_historique drop constraint logi_historique_type_check;
alter table logi_historique add constraint logi_historique_type_check
  check (type in ('creation', 'deplacement', 'etat', 'modification', 'correction', 'note',
                  'achat', 'pret', 'retour', 'retour_partiel', 'panne', 'reparation', 'stock', 'reservation'));

-- ── Cohérence (remplace la fonction du socle) ──────────────────────────
create or replace function logi_avant_ecriture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'logi_emplacements' then
    if new.parent_id is not null
       and not exists (select 1 from logi_emplacements p where p.id = new.parent_id and p.org_id = new.org_id) then
      raise exception 'L''emplacement parent doit appartenir à la même organisation';
    end if;
  elsif tg_table_name = 'logi_objets' then
    if tg_op = 'UPDATE' and new.org_id <> old.org_id then
      raise exception 'Un objet ne peut pas changer d''organisation';
    end if;
    if new.categorie_id is not null
       and not exists (select 1 from logi_categories c where c.id = new.categorie_id and c.org_id = new.org_id) then
      raise exception 'La catégorie doit appartenir à la même organisation';
    end if;
    if new.emplacement_id is not null
       and not exists (select 1 from logi_emplacements e where e.id = new.emplacement_id and e.org_id = new.org_id) then
      raise exception 'L''emplacement doit appartenir à la même organisation';
    end if;
    if new.parent_id is not null then
      if new.parent_id = new.id then
        raise exception 'Un objet ne peut pas être son propre kit';
      end if;
      if new.consommable then
        raise exception 'Un consommable ne peut pas faire partie d''un kit';
      end if;
      if not exists (select 1 from logi_objets p
                     where p.id = new.parent_id and p.org_id = new.org_id and p.parent_id is null and not p.consommable) then
        raise exception 'Le kit doit appartenir à la même organisation et ne pas être lui-même un élément d''un kit';
      end if;
      if exists (select 1 from logi_objets c where c.parent_id = new.id) then
        raise exception 'Cet objet contient déjà des éléments : il ne peut pas devenir lui-même un élément';
      end if;
    end if;
    new.maj_le := now();
  end if;
  return new;
end $$;

-- ── Trace de l'historique (remplace la fonction du socle) ──────────────
create or replace function logi_trace_objet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_avant text; v_apres text; c text; o jsonb; n jsonb;
  v_champs constant jsonb := '{"date_achat":"date d''achat","fournisseur":"fournisseur","prix_achat":"prix",
    "garantie_fin":"garantie","numero_serie":"numéro de série","facture_url":"facture",
    "facture_photo_path":"facture (photo)","financement":"financement","liens":"liens utiles","seuil_min":"seuil minimum"}';
begin
  if tg_op = 'INSERT' then
    insert into logi_historique (objet_id, org_id, type, apres) values (new.id, new.org_id, 'creation', new.nom);
    if new.date_achat is not null then
      insert into logi_historique (objet_id, org_id, type, apres, commentaire)
        values (new.id, new.org_id, 'achat', to_char(new.date_achat, 'DD/MM/YYYY'), new.fournisseur);
    end if;
    return new;
  end if;
  if new.emplacement_id is distinct from old.emplacement_id then
    select nom into v_avant from logi_emplacements where id = old.emplacement_id;
    select nom into v_apres from logi_emplacements where id = new.emplacement_id;
    insert into logi_historique (objet_id, org_id, type, avant, apres) values (new.id, new.org_id, 'deplacement', v_avant, v_apres);
  end if;
  if new.etat is distinct from old.etat then
    insert into logi_historique (objet_id, org_id, type, avant, apres) values (new.id, new.org_id, 'etat', old.etat, new.etat);
  end if;
  if new.nom is distinct from old.nom then
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', old.nom, new.nom, 'nom');
  end if;
  if new.categorie_id is distinct from old.categorie_id then
    select nom into v_avant from logi_categories where id = old.categorie_id;
    select nom into v_apres from logi_categories where id = new.categorie_id;
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', v_avant, v_apres, 'catégorie');
  end if;
  if new.notes is distinct from old.notes then
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', left(old.notes, 300), left(new.notes, 300), 'notes');
  end if;
  if new.photo_path is distinct from old.photo_path then
    insert into logi_historique (objet_id, org_id, type, commentaire) values (new.id, new.org_id, 'modification', 'photo');
  end if;
  if new.parent_id is distinct from old.parent_id then
    select nom into v_avant from logi_objets where id = old.parent_id;
    select nom into v_apres from logi_objets where id = new.parent_id;
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire) values (new.id, new.org_id, 'modification', v_avant, v_apres, 'kit');
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  for c in select jsonb_object_keys(v_champs) loop
    if o -> c is distinct from n -> c then
      insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire)
        values (new.id, new.org_id, 'modification', left(o ->> c, 300), left(n ->> c, 300), v_champs ->> c);
    end if;
  end loop;
  if new.quantite is distinct from old.quantite then
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire)
      values (new.id, new.org_id, 'stock', old.quantite::text, new.quantite::text, nullif(current_setting('logi.commentaire', true), ''));
  end if;
  return new;
end $$;

-- ── Prêts ──────────────────────────────────────────────────────────────
create table logi_prets (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references logi_organisations(id) on delete cascade,
  objet_id           uuid not null references logi_objets(id) on delete cascade,
  groupe_id          uuid not null default gen_random_uuid(), -- prêts d'un même kit
  emprunteur_id      uuid not null references logi_emprunteurs(id) on delete restrict,
  debut              timestamptz not null default now(),
  echeance           date not null,
  retour_le          timestamptz,
  etat_retour        text check (etat_retour in ('bon', 'use', 'defectueux', 'perdu')),
  commentaire        text check (commentaire is null or length(commentaire) <= 1000),
  commentaire_retour text check (commentaire_retour is null or length(commentaire_retour) <= 1000),
  pret_par           uuid default auth.uid(),
  retour_par         uuid
);
create unique index logi_prets_un_seul_ouvert on logi_prets (objet_id) where retour_le is null;
create index logi_prets_org on logi_prets (org_id, retour_le);
create index logi_prets_emprunteur on logi_prets (emprunteur_id);
create index logi_prets_groupe on logi_prets (groupe_id);

create table logi_reservations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references logi_organisations(id) on delete cascade,
  objet_id      uuid not null references logi_objets(id) on delete cascade,
  emprunteur_id uuid not null references logi_emprunteurs(id) on delete restrict,
  debut         timestamptz not null,
  fin           timestamptz not null check (fin > debut),
  statut        text not null default 'active' check (statut in ('active', 'annulee', 'terminee')),
  cree_par      uuid default auth.uid(),
  cree_le       timestamptz not null default now()
);
create index logi_reservations_objet on logi_reservations (objet_id, statut);

-- Fonctions d'appui (security definer : pas de récursion RLS)
create or replace function logi_est_emprunteur_moi(p_emprunteur uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from logi_emprunteurs where id = p_emprunteur and compte_id = auth.uid());
$$;

create or replace function logi_role_dans(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from logi_membres where user_id = auth.uid() and org_id = p_org;
$$;

-- Fiche emprunteur de l'appelant dans cette organisation (créée au besoin).
create or replace function logi_emprunteur_moi(p_org uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  select id into v_id from logi_emprunteurs where org_id = p_org and compte_id = auth.uid();
  if v_id is null then
    select email into v_email from logi_membres where org_id = p_org and user_id = auth.uid();
    insert into logi_emprunteurs (org_id, type, libelle, compte_id)
      values (p_org, 'enseignant', left(coalesce(v_email, 'Enseignant'), 60), auth.uid())
      returning id into v_id;
  end if;
  return v_id;
end $$;

-- Création d'un prêt (et de ceux des éléments du kit). Les contrôles de rôle sont faits par les appelants.
create or replace function logi_creer_pret(p_objet uuid, p_emprunteur uuid, p_echeance date, p_commentaire text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o logi_objets%rowtype; e logi_emprunteurs%rowtype; el logi_objets%rowtype;
  v_groupe uuid := gen_random_uuid(); v_exclus int; v_fin timestamptz; v_texte text;
begin
  select * into o from logi_objets where id = p_objet;
  if not found then raise exception 'Objet introuvable'; end if;
  select * into e from logi_emprunteurs where id = p_emprunteur and org_id = o.org_id;
  if not found then raise exception 'Emprunteur introuvable dans cette organisation'; end if;
  if o.consommable then raise exception 'Un consommable ne se prête pas : ajustez le stock'; end if;
  if o.parent_id is not null then raise exception 'Cet objet fait partie d''un kit : prêtez le kit entier'; end if;
  if o.etat not in ('bon', 'use') then raise exception 'Cet objet est hors service ou sorti : il ne peut pas être prêté'; end if;
  if p_echeance is null or p_echeance < current_date or p_echeance > current_date + 365 then
    raise exception 'L''échéance doit être comprise entre aujourd''hui et 365 jours';
  end if;
  if exists (select 1 from logi_prets where objet_id = o.id and retour_le is null) then
    raise exception 'Cet objet est déjà prêté';
  end if;

  v_fin := (p_echeance + 1)::timestamptz;
  if exists (select 1 from logi_reservations r
             where r.objet_id = o.id and r.statut = 'active' and r.emprunteur_id <> p_emprunteur
               and tstzrange(r.debut, r.fin) && tstzrange(now(), v_fin)) then
    raise exception 'Cet objet est réservé par quelqu''un d''autre sur cette période';
  end if;

  select count(*) into v_exclus from logi_objets c
    where c.parent_id = o.id
      and (c.etat not in ('bon', 'use') or exists (select 1 from logi_prets p where p.objet_id = c.id and p.retour_le is null));

  v_texte := 'jusqu''au ' || to_char(p_echeance, 'DD/MM/YYYY')
    || case when v_exclus > 0 then ' (sans ' || v_exclus || ' élément(s) hors service ou déjà sorti(s))' else '' end
    || coalesce(' : ' || p_commentaire, '');

  begin
    insert into logi_prets (org_id, objet_id, groupe_id, emprunteur_id, echeance, commentaire)
      values (o.org_id, o.id, v_groupe, e.id, p_echeance, p_commentaire);
    insert into logi_historique (objet_id, org_id, type, apres, commentaire) values (o.id, o.org_id, 'pret', e.libelle, v_texte);
    for el in select * from logi_objets c where c.parent_id = o.id order by c.nom loop
      if el.etat in ('bon', 'use') and not exists (select 1 from logi_prets p where p.objet_id = el.id and p.retour_le is null) then
        insert into logi_prets (org_id, objet_id, groupe_id, emprunteur_id, echeance, commentaire)
          values (o.org_id, el.id, v_groupe, e.id, p_echeance, p_commentaire);
        insert into logi_historique (objet_id, org_id, type, apres, commentaire)
          values (el.id, o.org_id, 'pret', e.libelle, 'jusqu''au ' || to_char(p_echeance, 'DD/MM/YYYY') || ' (avec ' || o.nom || ')');
      end if;
    end loop;
  exception when unique_violation then
    raise exception 'Cet objet est déjà prêté';
  end;

  -- Le détenteur d'une réservation qui emprunte la convertit.
  update logi_reservations set statut = 'terminee'
    where objet_id = o.id and emprunteur_id = e.id and statut = 'active'
      and tstzrange(debut, fin) && tstzrange(now(), v_fin);
  return v_groupe;
end $$;

create or replace function logi_preter(p_objet uuid, p_emprunteur uuid, p_echeance date, p_commentaire text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from logi_objets where id = p_objet;
  if v_org is null or coalesce(logi_role_dans(v_org), '') not in ('admin', 'gestionnaire') then
    raise exception 'Vous n''avez pas le droit de prêter ce matériel' using errcode = '42501';
  end if;
  return logi_creer_pret(p_objet, p_emprunteur, p_echeance, p_commentaire);
end $$;

create or replace function logi_emprunter(p_objet uuid, p_echeance date, p_commentaire text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from logi_objets where id = p_objet;
  if v_org is null or coalesce(logi_role_dans(v_org), '') not in ('admin', 'gestionnaire', 'emprunteur') then
    raise exception 'Vous n''avez pas le droit d''emprunter ce matériel' using errcode = '42501';
  end if;
  return logi_creer_pret(p_objet, logi_emprunteur_moi(v_org), p_echeance, p_commentaire);
end $$;

create or replace function logi_rendre(p_prets uuid[], p_etat text default 'bon', p_commentaire text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pr logi_prets%rowtype; v_groupe uuid; v_manque text; v_racine uuid; v_trouves int;
begin
  if p_prets is null or coalesce(array_length(p_prets, 1), 0) = 0 then raise exception 'Aucun prêt à rendre'; end if;
  if p_etat not in ('bon', 'use', 'defectueux', 'perdu') then raise exception 'État de retour invalide'; end if;
  select count(*) into v_trouves from logi_prets where id = any (p_prets) and retour_le is null;
  if v_trouves <> (select count(distinct x) from unnest(p_prets) x) then
    raise exception 'Un des prêts est introuvable ou déjà rendu';
  end if;
  for pr in select * from logi_prets where id = any (p_prets) and retour_le is null loop
    if coalesce(logi_role_dans(pr.org_id), '') not in ('admin', 'gestionnaire') and not logi_est_emprunteur_moi(pr.emprunteur_id) then
      raise exception 'Vous ne pouvez rendre que vos propres prêts' using errcode = '42501';
    end if;
  end loop;
  for pr in select * from logi_prets where id = any (p_prets) and retour_le is null loop
    update logi_prets set retour_le = now(), etat_retour = p_etat, commentaire_retour = p_commentaire, retour_par = auth.uid() where id = pr.id;
    if p_etat in ('use', 'defectueux', 'perdu') then
      update logi_objets set etat = p_etat where id = pr.objet_id and etat is distinct from p_etat;
    end if;
    insert into logi_historique (objet_id, org_id, type, apres, commentaire) values (pr.objet_id, pr.org_id, 'retour', p_etat, p_commentaire);
  end loop;
  for v_groupe in select distinct groupe_id from logi_prets where id = any (p_prets) loop
    select string_agg(o.nom, ', ' order by o.nom) into v_manque
      from logi_prets p join logi_objets o on o.id = p.objet_id where p.groupe_id = v_groupe and p.retour_le is null;
    if v_manque is not null then
      select p.objet_id into v_racine from logi_prets p join logi_objets o on o.id = p.objet_id
        where p.groupe_id = v_groupe and o.parent_id is null limit 1;
      if v_racine is not null then
        insert into logi_historique (objet_id, org_id, type, commentaire)
          select v_racine, org_id, 'retour_partiel', 'Il manque : ' || v_manque from logi_objets where id = v_racine;
      end if;
    end if;
  end loop;
end $$;

create or replace function logi_prolonger(p_pret uuid, p_echeance date) returns void
language plpgsql security definer set search_path = public as $$
declare pr logi_prets%rowtype;
begin
  select * into pr from logi_prets where id = p_pret and retour_le is null;
  if not found then raise exception 'Prêt introuvable ou déjà rendu'; end if;
  if coalesce(logi_role_dans(pr.org_id), '') not in ('admin', 'gestionnaire') and not logi_est_emprunteur_moi(pr.emprunteur_id) then
    raise exception 'Vous ne pouvez prolonger que vos propres prêts' using errcode = '42501';
  end if;
  if p_echeance is null or p_echeance < current_date or p_echeance > current_date + 365 then
    raise exception 'L''échéance doit être comprise entre aujourd''hui et 365 jours';
  end if;
  insert into logi_historique (objet_id, org_id, type, apres, commentaire)
    select objet_id, org_id, 'pret', null, 'Prolongé jusqu''au ' || to_char(p_echeance, 'DD/MM/YYYY')
    from logi_prets where groupe_id = pr.groupe_id and retour_le is null;
  update logi_prets set echeance = p_echeance where groupe_id = pr.groupe_id and retour_le is null;
end $$;

-- ── Pannes, réparations, stock ─────────────────────────────────────────
create or replace function logi_signaler(p_objet uuid, p_commentaire text) returns void
language plpgsql security definer set search_path = public as $$
declare o logi_objets%rowtype;
begin
  select * into o from logi_objets where id = p_objet;
  if not found or logi_role_dans(o.org_id) is null then
    raise exception 'Vous n''avez pas le droit de signaler ce matériel' using errcode = '42501';
  end if;
  if o.etat in ('bon', 'use') then update logi_objets set etat = 'defectueux' where id = o.id; end if;
  insert into logi_historique (objet_id, org_id, type, commentaire) values (o.id, o.org_id, 'panne', p_commentaire);
end $$;

create or replace function logi_reparer(p_objet uuid, p_commentaire text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o logi_objets%rowtype;
begin
  select * into o from logi_objets where id = p_objet;
  if not found or coalesce(logi_role_dans(o.org_id), '') not in ('admin', 'gestionnaire') then
    raise exception 'Vous n''avez pas le droit de réparer ce matériel' using errcode = '42501';
  end if;
  update logi_objets set etat = 'bon' where id = o.id and etat <> 'bon';
  insert into logi_historique (objet_id, org_id, type, commentaire) values (o.id, o.org_id, 'reparation', p_commentaire);
end $$;

create or replace function logi_ajuster_stock(p_objet uuid, p_delta integer, p_commentaire text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare o logi_objets%rowtype; v_q integer;
begin
  select * into o from logi_objets where id = p_objet;
  if not found or coalesce(logi_role_dans(o.org_id), '') not in ('admin', 'gestionnaire') then
    raise exception 'Vous n''avez pas le droit de modifier ce stock' using errcode = '42501';
  end if;
  if not o.consommable then raise exception 'Cet objet n''est pas un consommable'; end if;
  v_q := o.quantite + p_delta;
  if v_q < 0 then raise exception 'Stock insuffisant : il en reste %', o.quantite; end if;
  perform set_config('logi.commentaire', coalesce(p_commentaire, ''), true);
  update logi_objets set quantite = v_q where id = o.id;
  perform set_config('logi.commentaire', '', true);
  return v_q;
end $$;

-- ── Réservations ───────────────────────────────────────────────────────
create or replace function logi_reserver(p_objet uuid, p_debut timestamptz, p_fin timestamptz, p_emprunteur uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o logi_objets%rowtype; v_role text; v_emp uuid; v_id uuid; v_libelle text; v_pret date;
begin
  select * into o from logi_objets where id = p_objet;
  if not found then raise exception 'Objet introuvable'; end if;
  v_role := logi_role_dans(o.org_id);
  if coalesce(v_role, '') not in ('admin', 'gestionnaire', 'emprunteur') then
    raise exception 'Vous n''avez pas le droit de réserver ce matériel' using errcode = '42501';
  end if;
  if p_emprunteur is null then
    v_emp := logi_emprunteur_moi(o.org_id);
  else
    if v_role = 'emprunteur' then
      raise exception 'Un enseignant ne réserve que pour lui-même' using errcode = '42501';
    end if;
    select id into v_emp from logi_emprunteurs where id = p_emprunteur and org_id = o.org_id;
    if v_emp is null then raise exception 'Emprunteur introuvable dans cette organisation'; end if;
  end if;
  if o.consommable then raise exception 'Un consommable ne se réserve pas'; end if;
  if o.parent_id is not null then raise exception 'Cet objet fait partie d''un kit : réservez le kit entier'; end if;
  if o.etat not in ('bon', 'use') then raise exception 'Cet objet est hors service ou sorti : il ne peut pas être réservé'; end if;
  if p_debut is null or p_fin is null or p_fin <= p_debut then raise exception 'La fin doit être après le début'; end if;
  if p_fin - p_debut > interval '30 days' then raise exception 'Une réservation dure 30 jours au plus'; end if;
  if p_debut < now() - interval '1 hour' then raise exception 'Le début de la réservation est déjà passé'; end if;

  perform pg_advisory_xact_lock(hashtext(o.id::text));
  if exists (select 1 from logi_reservations r where r.objet_id = o.id and r.statut = 'active'
             and tstzrange(r.debut, r.fin) && tstzrange(p_debut, p_fin)) then
    raise exception 'Ce créneau est déjà réservé';
  end if;
  select echeance into v_pret from logi_prets p where p.objet_id = o.id and p.retour_le is null
    and tstzrange(p.debut, (p.echeance + 1)::timestamptz) && tstzrange(p_debut, p_fin);
  if v_pret is not null then
    raise exception 'Cet objet est prêté jusqu''au %', to_char(v_pret, 'DD/MM/YYYY');
  end if;

  insert into logi_reservations (org_id, objet_id, emprunteur_id, debut, fin) values (o.org_id, o.id, v_emp, p_debut, p_fin) returning id into v_id;
  select libelle into v_libelle from logi_emprunteurs where id = v_emp;
  insert into logi_historique (objet_id, org_id, type, apres, commentaire)
    values (o.id, o.org_id, 'reservation', v_libelle, 'du ' || to_char(p_debut, 'DD/MM/YYYY HH24:MI') || ' au ' || to_char(p_fin, 'DD/MM/YYYY HH24:MI'));
  return v_id;
end $$;

create or replace function logi_annuler_reservation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r logi_reservations%rowtype;
begin
  select * into r from logi_reservations where id = p_id and statut = 'active';
  if not found then raise exception 'Réservation introuvable ou déjà terminée'; end if;
  if coalesce(logi_role_dans(r.org_id), '') not in ('admin', 'gestionnaire') and not logi_est_emprunteur_moi(r.emprunteur_id) then
    raise exception 'Vous ne pouvez annuler que vos propres réservations' using errcode = '42501';
  end if;
  update logi_reservations set statut = 'annulee' where id = r.id;
  insert into logi_historique (objet_id, org_id, type, commentaire) values (r.objet_id, r.org_id, 'reservation', 'Réservation annulée');
end $$;

-- ── Création en lot : accepte achat, liens, kit, stock (remplace la fonction du socle) ──
create or replace function logi_creer_objets(p_org uuid, p_objets jsonb)
returns table (objet_id uuid, objet_code text)
language plpgsql security invoker set search_path = public as $$
begin
  if jsonb_typeof(p_objets) <> 'array' then
    raise exception 'La liste d''objets est invalide';
  end if;
  if jsonb_array_length(p_objets) < 1 or jsonb_array_length(p_objets) > 100 then
    raise exception 'Entre 1 et 100 objets par opération';
  end if;
  return query
    insert into logi_objets (org_id, nom, categorie_id, emplacement_id, etat, photo_path, notes, code,
                             date_achat, fournisseur, prix_achat, garantie_fin, numero_serie, facture_url,
                             facture_photo_path, financement, liens, parent_id, consommable, quantite, seuil_min)
    select p_org, o.nom, o.categorie_id, o.emplacement_id, coalesce(o.etat, 'bon'), o.photo_path, o.notes, o.code,
           o.date_achat, o.fournisseur, o.prix_achat, o.garantie_fin, o.numero_serie, o.facture_url,
           o.facture_photo_path, o.financement, coalesce(o.liens, '[]'::jsonb), o.parent_id, coalesce(o.consommable, false),
           o.quantite, o.seuil_min
    from jsonb_to_recordset(p_objets) as o(
      nom text, categorie_id uuid, emplacement_id uuid, etat text, photo_path text, notes text, code text,
      date_achat date, fournisseur text, prix_achat numeric, garantie_fin date, numero_serie text, facture_url text,
      facture_photo_path text, financement text, liens jsonb, parent_id uuid, consommable boolean, quantite integer, seuil_min integer)
    returning logi_objets.id, logi_objets.code;
end $$;

-- ── Fonctions : droits d'exécution ─────────────────────────────────────
revoke all on function logi_liens_valides(jsonb) from public, anon;
revoke all on function logi_est_emprunteur_moi(uuid) from public, anon;
revoke all on function logi_role_dans(uuid) from public, anon;
revoke all on function logi_emprunteur_moi(uuid) from public, anon, authenticated;
revoke all on function logi_creer_pret(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function logi_preter(uuid, uuid, date, text) from public, anon;
revoke all on function logi_emprunter(uuid, date, text) from public, anon;
revoke all on function logi_rendre(uuid[], text, text) from public, anon;
revoke all on function logi_prolonger(uuid, date) from public, anon;
revoke all on function logi_signaler(uuid, text) from public, anon;
revoke all on function logi_reparer(uuid, text) from public, anon;
revoke all on function logi_ajuster_stock(uuid, integer, text) from public, anon;
revoke all on function logi_reserver(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function logi_annuler_reservation(uuid) from public, anon;
revoke all on function logi_creer_objets(uuid, jsonb) from public, anon;
grant execute on function logi_liens_valides(jsonb) to authenticated;
grant execute on function logi_est_emprunteur_moi(uuid) to authenticated;
grant execute on function logi_role_dans(uuid) to authenticated;
grant execute on function logi_preter(uuid, uuid, date, text) to authenticated;
grant execute on function logi_emprunter(uuid, date, text) to authenticated;
grant execute on function logi_rendre(uuid[], text, text) to authenticated;
grant execute on function logi_prolonger(uuid, date) to authenticated;
grant execute on function logi_signaler(uuid, text) to authenticated;
grant execute on function logi_reparer(uuid, text) to authenticated;
grant execute on function logi_ajuster_stock(uuid, integer, text) to authenticated;
grant execute on function logi_reserver(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function logi_annuler_reservation(uuid) to authenticated;
grant execute on function logi_creer_objets(uuid, jsonb) to authenticated;

-- ── RLS et droits : lecture seule pour les utilisateurs, écriture par les fonctions ──
alter table logi_prets enable row level security;
alter table logi_reservations enable row level security;

create policy logi_prets_select on logi_prets for select to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire', 'lecture']) or logi_est_emprunteur_moi(emprunteur_id));
create policy logi_reservations_select on logi_reservations for select to authenticated
  using (logi_est_membre(org_id));

-- Un enseignant ne voit que sa propre fiche emprunteur.
drop policy logi_emprunteurs_select on logi_emprunteurs;
create policy logi_emprunteurs_select on logi_emprunteurs for select to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire', 'lecture']) or compte_id = auth.uid());

revoke all on logi_prets, logi_reservations from anon, authenticated, service_role;
grant select on logi_prets, logi_reservations to authenticated;
grant select, insert, update, delete on logi_prets, logi_reservations to service_role;

commit;
