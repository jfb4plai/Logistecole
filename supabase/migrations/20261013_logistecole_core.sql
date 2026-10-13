-- Logistécole — socle : organisations, membres, inventaire, historique en écriture seule.
-- Tables préfixées logi_. profiles et son trigger updated_at ne sont pas touchés.
begin;

-- ── Organisations et membres ───────────────────────────────────────────
create table logi_organisations (
  id      uuid primary key default gen_random_uuid(),
  nom     text not null check (length(trim(nom)) between 1 and 120),
  type    text not null check (type in ('pole', 'ecole')),
  statut  text not null default 'actif' check (statut in ('actif', 'suspendu')), -- informatif en v1
  cree_le timestamptz not null default now()
);

create table logi_membres (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references logi_organisations(id) on delete cascade,
  role    text not null check (role in ('admin', 'gestionnaire', 'lecture')),
  email   text,
  cree_le timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index logi_membres_org on logi_membres (org_id);

-- Fonctions d'accès : security definer, donc pas de récursion RLS.
create or replace function logi_est_membre(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from logi_membres where user_id = auth.uid() and org_id = p_org);
$$;

create or replace function logi_a_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from logi_membres
    where user_id = auth.uid() and org_id = p_org and role = any (p_roles)
  );
$$;

revoke all on function logi_est_membre(uuid) from public, anon;
revoke all on function logi_a_role(uuid, text[]) from public, anon;
grant execute on function logi_est_membre(uuid) to authenticated;
grant execute on function logi_a_role(uuid, text[]) to authenticated;

-- ── Inventaire ─────────────────────────────────────────────────────────
create table logi_emplacements (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references logi_organisations(id) on delete cascade,
  parent_id uuid references logi_emplacements(id) on delete restrict,
  nom       text not null check (length(trim(nom)) between 1 and 120),
  cree_le   timestamptz not null default now()
);
create unique index logi_emplacements_nom
  on logi_emplacements (org_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nom));

create table logi_categories (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references logi_organisations(id) on delete cascade,
  nom     text not null check (length(trim(nom)) between 1 and 120),
  cree_le timestamptz not null default now(),
  unique (org_id, nom)
);

create table logi_objets (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references logi_organisations(id) on delete cascade,
  nom            text not null check (length(trim(nom)) between 1 and 120),
  categorie_id   uuid references logi_categories(id) on delete restrict,
  emplacement_id uuid references logi_emplacements(id) on delete restrict,
  etat           text not null default 'bon' check (etat in ('bon', 'use', 'defectueux', 'perdu', 'sorti')),
  photo_path     text,
  notes          text check (notes is null or length(notes) <= 2000),
  code           text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
create index logi_objets_org on logi_objets (org_id);

create table logi_historique (
  id           bigint generated always as identity primary key,
  objet_id     uuid not null references logi_objets(id) on delete cascade,
  org_id       uuid not null references logi_organisations(id) on delete cascade,
  auteur       uuid default auth.uid(),
  auteur_email text default (auth.jwt() ->> 'email'),
  quand        timestamptz not null default now(),
  type         text not null check (type in ('creation', 'deplacement', 'etat', 'modification', 'correction', 'note')),
  avant        text,
  apres        text,
  commentaire  text check (commentaire is null or length(commentaire) <= 1000)
);
create index logi_historique_objet on logi_historique (objet_id, quand desc);

create table logi_emprunteurs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references logi_organisations(id) on delete cascade,
  type         text not null check (type in ('enseignant', 'eleve', 'organisation')),
  libelle      text not null check (length(trim(libelle)) between 1 and 60), -- initiales ou code anonyme
  org_liee_id  uuid references logi_organisations(id) on delete set null,
  compte_id    uuid references auth.users(id) on delete set null, -- lien futur (sous-projet 4)
  cree_le      timestamptz not null default now()
);

-- ── Triggers : cohérence, horodatage, trace historique, dernier admin ──
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
    new.maj_le := now();
  end if;
  return new;
end $$;

create trigger logi_emplacements_avant before insert or update on logi_emplacements
  for each row execute function logi_avant_ecriture();
create trigger logi_objets_avant before insert or update on logi_objets
  for each row execute function logi_avant_ecriture();

create or replace function logi_trace_objet() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_avant text; v_apres text;
begin
  if tg_op = 'INSERT' then
    insert into logi_historique (objet_id, org_id, type, apres) values (new.id, new.org_id, 'creation', new.nom);
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
  return new;
end $$;

create trigger logi_objets_trace after insert or update on logi_objets
  for each row execute function logi_trace_objet();

-- Une organisation garde toujours au moins un administrateur.
create or replace function logi_garder_un_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if exists (select 1 from logi_organisations where id = old.org_id)
       and not exists (select 1 from logi_membres where org_id = old.org_id and role = 'admin' and user_id <> old.user_id) then
      raise exception 'Une organisation doit garder au moins un administrateur';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger logi_membres_garder_admin before update or delete on logi_membres
  for each row execute function logi_garder_un_admin();

-- ── RPC : création en lot atomique (max 100) ───────────────────────────
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
    insert into logi_objets (org_id, nom, categorie_id, emplacement_id, etat, photo_path, notes, code)
    select p_org, o.nom, o.categorie_id, o.emplacement_id, coalesce(o.etat, 'bon'), o.photo_path, o.notes, o.code
    from jsonb_to_recordset(p_objets) as o(nom text, categorie_id uuid, emplacement_id uuid, etat text, photo_path text, notes text, code text)
    returning logi_objets.id, logi_objets.code;
end $$;

revoke all on function logi_creer_objets(uuid, jsonb) from public, anon;
grant execute on function logi_creer_objets(uuid, jsonb) to authenticated;

-- ── Fonctions réservées à l'administration (SQL Editor / clé service) ──
create or replace function logi_nouvelle_organisation(p_nom text, p_type text, p_admin uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  insert into logi_organisations (nom, type) values (p_nom, p_type) returning id into v_id;
  select email into v_email from auth.users where id = p_admin;
  insert into logi_membres (user_id, org_id, role, email) values (p_admin, v_id, 'admin', v_email);
  insert into logi_categories (org_id, nom)
    select v_id, c from unnest(array[
      'Tablettes et ordinateurs', 'Projection et son', 'Matériel de sciences', 'Matériel de sport',
      'Manuels et livres', 'Matériel d''aménagements raisonnables', 'Mobilier', 'Autre'
    ]) as c;
  return v_id;
end $$;

create or replace function logi_id_par_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function logi_nouvelle_organisation(text, text, uuid) from public, anon, authenticated;
revoke all on function logi_id_par_email(text) from public, anon, authenticated;
grant execute on function logi_id_par_email(text) to service_role;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table logi_organisations enable row level security;
alter table logi_membres       enable row level security;
alter table logi_emplacements  enable row level security;
alter table logi_categories    enable row level security;
alter table logi_objets        enable row level security;
alter table logi_historique    enable row level security;
alter table logi_emprunteurs   enable row level security;

create policy logi_orgs_select on logi_organisations for select to authenticated
  using (logi_est_membre(id));

create policy logi_membres_select on logi_membres for select to authenticated
  using (user_id = auth.uid() or logi_a_role(org_id, array['admin']));
create policy logi_membres_update on logi_membres for update to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));
create policy logi_membres_delete on logi_membres for delete to authenticated
  using (logi_a_role(org_id, array['admin']));

create policy logi_emplacements_select on logi_emplacements for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_emplacements_ecrire on logi_emplacements for all to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));

create policy logi_categories_select on logi_categories for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_categories_ecrire on logi_categories for all to authenticated
  using (logi_a_role(org_id, array['admin'])) with check (logi_a_role(org_id, array['admin']));

create policy logi_objets_select on logi_objets for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_objets_insert on logi_objets for insert to authenticated
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));
create policy logi_objets_update on logi_objets for update to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire']))
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));
create policy logi_objets_delete on logi_objets for delete to authenticated
  using (logi_a_role(org_id, array['admin']));

create policy logi_historique_select on logi_historique for select to authenticated
  using (logi_est_membre(org_id));
-- Le client n'écrit que des corrections et des notes ; le reste vient des triggers.
create policy logi_historique_insert on logi_historique for insert to authenticated
  with check (
    logi_a_role(org_id, array['admin', 'gestionnaire'])
    and auteur = auth.uid()
    and type in ('correction', 'note')
    and org_id = (select o.org_id from logi_objets o where o.id = objet_id)
  );

create policy logi_emprunteurs_select on logi_emprunteurs for select to authenticated
  using (logi_est_membre(org_id));
create policy logi_emprunteurs_ecrire on logi_emprunteurs for all to authenticated
  using (logi_a_role(org_id, array['admin', 'gestionnaire']))
  with check (logi_a_role(org_id, array['admin', 'gestionnaire']));

-- ── Grants Data API (anon : aucun accès) ───────────────────────────────
-- Supabase accorde par défaut tous les droits aux nouvelles tables : on repart de zéro
-- puis on accorde uniquement ce qui est voulu (RLS filtre ensuite les lignes).
revoke all on logi_organisations, logi_membres, logi_emplacements, logi_categories,
              logi_objets, logi_historique, logi_emprunteurs from anon, authenticated, service_role;

grant select on logi_organisations to authenticated;
grant select on logi_organisations to service_role;

grant select, delete on logi_membres to authenticated;
grant update (role) on logi_membres to authenticated;
grant select, insert, update, delete on logi_membres to service_role;

grant select, insert, update, delete on logi_emplacements to authenticated, service_role;
grant select, insert, update, delete on logi_categories   to authenticated, service_role;
grant select, insert, update, delete on logi_objets       to authenticated, service_role;
grant select, insert on logi_historique to authenticated, service_role; -- jamais update ni delete
grant select, insert, update, delete on logi_emprunteurs  to authenticated, service_role;

-- ── Photos : bucket privé, chemins <org_id>/<fichier>.jpg ──────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logi-photos', 'logi-photos', false, 512000, array['image/jpeg'])
on conflict (id) do nothing;

create policy logi_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'logi-photos' and logi_est_membre(((storage.foldername(name))[1])::uuid));
create policy logi_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));
create policy logi_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));
create policy logi_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logi-photos' and logi_a_role(((storage.foldername(name))[1])::uuid, array['admin', 'gestionnaire']));

commit;
