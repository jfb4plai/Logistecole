-- Logistécole : fiche enrichie (type, auteur, éditeur, ISBN, description, critères « Pour qui ? »).
-- Dépend des tables ar_chapitres et ar_amenagements d'AménagActif (même projet Supabase, lues sans copie).
begin;

-- ── ISBN : 10 ou 13 caractères, clé contrôlée, sans tirets ─────────────
create or replace function logi_isbn_valide(p text) returns boolean
language plpgsql immutable as $$
declare i int; s int := 0; c text;
begin
  if p is null then return false; end if;
  if p ~ '^[0-9]{13}$' then
    for i in 1..12 loop
      s := s + substr(p, i, 1)::int * case when i % 2 = 1 then 1 else 3 end;
    end loop;
    return (10 - s % 10) % 10 = substr(p, 13, 1)::int;
  elsif p ~ '^[0-9]{9}[0-9Xx]$' then
    for i in 1..9 loop
      s := s + substr(p, i, 1)::int * (11 - i);
    end loop;
    c := upper(substr(p, 10, 1));
    s := s + case when c = 'X' then 10 else c::int end;
    return s % 11 = 0;
  end if;
  return false;
end $$;

-- ── Colonnes de la fiche ───────────────────────────────────────────────
alter table logi_objets
  add column type_ressource text not null default 'physique'
    check (type_ressource in ('physique', 'numerique', 'les_deux')),
  add column auteur text check (auteur is null or length(auteur) <= 200),
  add column editeur text check (editeur is null or length(editeur) <= 200),
  add column isbn text check (isbn is null or logi_isbn_valide(isbn)),
  add column description text check (description is null or length(description) <= 2000),
  add column description_a_relire boolean not null default false,
  add column autre_trouble text check (autre_trouble is null or length(trim(autre_trouble)) between 1 and 500),
  add column autre_difficulte text check (autre_difficulte is null or length(trim(autre_difficulte)) between 1 and 500),
  add column autre_amenagement text check (autre_amenagement is null or length(trim(autre_amenagement)) between 1 and 500);

-- ── Création en lot : accepte aussi les colonnes de la fiche ───────────
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
                             facture_photo_path, financement, liens, parent_id, consommable, quantite, seuil_min,
                             type_ressource, auteur, editeur, isbn, description, description_a_relire,
                             autre_trouble, autre_difficulte, autre_amenagement)
    select p_org, o.nom, o.categorie_id, o.emplacement_id, coalesce(o.etat, 'bon'), o.photo_path, o.notes, o.code,
           o.date_achat, o.fournisseur, o.prix_achat, o.garantie_fin, o.numero_serie, o.facture_url,
           o.facture_photo_path, o.financement, coalesce(o.liens, '[]'::jsonb), o.parent_id, coalesce(o.consommable, false),
           o.quantite, o.seuil_min,
           coalesce(o.type_ressource, 'physique'), o.auteur, o.editeur, o.isbn, o.description, coalesce(o.description_a_relire, false),
           o.autre_trouble, o.autre_difficulte, o.autre_amenagement
    from jsonb_to_recordset(p_objets) as o(
      nom text, categorie_id uuid, emplacement_id uuid, etat text, photo_path text, notes text, code text,
      date_achat date, fournisseur text, prix_achat numeric, garantie_fin date, numero_serie text, facture_url text,
      facture_photo_path text, financement text, liens jsonb, parent_id uuid, consommable boolean, quantite integer, seuil_min integer,
      type_ressource text, auteur text, editeur text, isbn text, description text, description_a_relire boolean,
      autre_trouble text, autre_difficulte text, autre_amenagement text)
    returning logi_objets.id, logi_objets.code;
end $$;

revoke all on function logi_isbn_valide(text) from public, anon;
revoke all on function logi_creer_objets(uuid, jsonb) from public, anon;
grant execute on function logi_isbn_valide(text) to authenticated;
grant execute on function logi_creer_objets(uuid, jsonb) to authenticated;

-- ── Critères « Pour qui ? » : listes fermées, écrites par migration seulement ──
create table logi_criteres (
  id      uuid primary key default gen_random_uuid(),
  famille text not null check (famille in ('trouble', 'difficulte')),
  code    text not null unique check (code ~ '^[a-z_]+$'),
  libelle text not null check (length(trim(libelle)) between 1 and 80),
  aide    text check (aide is null or length(aide) <= 300),
  ordre   integer not null,
  actif   boolean not null default true
);

-- L'aide décrit l'usage de l'étiquette, pas le trouble (rédaction proposée, à relire par JF).
insert into logi_criteres (famille, code, libelle, ordre, aide)
select v.famille, v.code, v.libelle, v.ordre,
       'Utile à des élèves concernés par : ' || case when v.code in ('tdah', 'tsa') then v.libelle else lower(v.libelle) end
       || '. Étiquette indicative.'
from (values
  ('trouble', 'dyslexie', 'Dyslexie', 1), ('trouble', 'dysorthographie', 'Dysorthographie', 2),
  ('trouble', 'dyscalculie', 'Dyscalculie', 3), ('trouble', 'dyspraxie', 'Dyspraxie', 4),
  ('trouble', 'dysphasie', 'Dysphasie', 5), ('trouble', 'tdah', 'TDAH', 6), ('trouble', 'tsa', 'TSA', 7),
  ('difficulte', 'lecture', 'Lecture', 1), ('difficulte', 'ecriture', 'Écriture', 2),
  ('difficulte', 'calcul', 'Calcul', 3), ('difficulte', 'attention', 'Attention', 4),
  ('difficulte', 'memoire_travail', 'Mémoire de travail', 5), ('difficulte', 'langage_oral', 'Langage oral', 6)
) as v(famille, code, libelle, ordre);

create table logi_objets_criteres (
  objet_id   uuid not null references logi_objets(id) on delete cascade,
  critere_id uuid not null references logi_criteres(id) on delete restrict,
  primary key (objet_id, critere_id)
);

-- Aménagements : un chapitre entier OU un aménagement précis du catalogue AménagActif.
create table logi_objets_amenagements (
  objet_id       uuid not null references logi_objets(id) on delete cascade,
  chapitre_id    uuid references ar_chapitres(id) on delete cascade,
  amenagement_id uuid references ar_amenagements(id) on delete cascade,
  check (num_nonnulls(chapitre_id, amenagement_id) = 1)
);
create unique index logi_objets_amenagements_chapitre on logi_objets_amenagements (objet_id, chapitre_id) where chapitre_id is not null;
create unique index logi_objets_amenagements_precis on logi_objets_amenagements (objet_id, amenagement_id) where amenagement_id is not null;

-- Organisation d'un objet (security definer : pas de récursion RLS).
create or replace function logi_org_de_objet(p_objet uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from logi_objets where id = p_objet;
$$;

-- Remplace en bloc les critères d'un objet. Seuls admin et gestionnaire de son organisation.
create or replace function logi_definir_criteres(p_objet uuid, p_criteres uuid[], p_chapitres uuid[], p_amenagements uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_crit uuid[]; v_chap uuid[]; v_amgt uuid[];
  v_avant_c uuid[]; v_avant_ch uuid[]; v_avant_a uuid[];
  v_avant text; v_apres text;
begin
  v_org := logi_org_de_objet(p_objet);
  if v_org is null or not logi_a_role(v_org, array['admin', 'gestionnaire']) then
    raise exception 'Réservé aux administrateurs et gestionnaires de l''organisation' using errcode = '42501';
  end if;

  v_crit := array(select distinct u from unnest(coalesce(p_criteres, '{}')) u order by u);
  v_chap := array(select distinct u from unnest(coalesce(p_chapitres, '{}')) u order by u);
  if exists (select 1 from unnest(coalesce(p_amenagements, '{}')) u where not exists (select 1 from ar_amenagements a where a.id = u)) then
    raise exception 'Aménagement inconnu' using errcode = '23503';
  end if;
  -- Un aménagement dont le chapitre est coché en entier est déjà inclus.
  v_amgt := array(
    select distinct a.id from ar_amenagements a
    where a.id = any (coalesce(p_amenagements, '{}')) and not (a.chapitre_id = any (v_chap)) order by a.id);

  if exists (select 1 from logi_criteres c where c.id = any (v_crit) and not c.actif
             and not exists (select 1 from logi_objets_criteres l where l.objet_id = p_objet and l.critere_id = c.id)) then
    raise exception 'Ce critère n''est plus proposé' using errcode = '23514';
  end if;
  if exists (select 1 from ar_amenagements a where a.id = any (v_amgt) and not a.actif
             and not exists (select 1 from logi_objets_amenagements l where l.objet_id = p_objet and l.amenagement_id = a.id)) then
    raise exception 'Cet aménagement n''est plus proposé' using errcode = '23514';
  end if;

  v_avant_c := array(select critere_id from logi_objets_criteres where objet_id = p_objet order by 1);
  v_avant_ch := array(select chapitre_id from logi_objets_amenagements where objet_id = p_objet and chapitre_id is not null order by 1);
  v_avant_a := array(select amenagement_id from logi_objets_amenagements where objet_id = p_objet and amenagement_id is not null order by 1);
  if v_avant_c = v_crit and v_avant_ch = v_chap and v_avant_a = v_amgt then return; end if;

  v_avant := coalesce((select string_agg(libelle, ', ' order by ordre) from logi_criteres where id = any (v_avant_c)), '')
    || ' | chapitres : ' || cardinality(v_avant_ch) || ' | aménagements : ' || cardinality(v_avant_a);
  v_apres := coalesce((select string_agg(libelle, ', ' order by ordre) from logi_criteres where id = any (v_crit)), '')
    || ' | chapitres : ' || cardinality(v_chap) || ' | aménagements : ' || cardinality(v_amgt);

  delete from logi_objets_criteres where objet_id = p_objet;
  delete from logi_objets_amenagements where objet_id = p_objet;
  insert into logi_objets_criteres (objet_id, critere_id) select p_objet, u from unnest(v_crit) u;
  insert into logi_objets_amenagements (objet_id, chapitre_id) select p_objet, u from unnest(v_chap) u;
  insert into logi_objets_amenagements (objet_id, amenagement_id) select p_objet, u from unnest(v_amgt) u;
  insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire)
    values (p_objet, v_org, 'modification', left(v_avant, 300), left(v_apres, 300), 'critères');
end $$;

-- Trace des champs de la fiche modifiés directement sur l'objet.
create or replace function logi_trace_fiche() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in
    select * from (values
      ('autre trouble', old.autre_trouble, new.autre_trouble),
      ('autre difficulté', old.autre_difficulte, new.autre_difficulte),
      ('autre aménagement', old.autre_amenagement, new.autre_amenagement),
      ('description', old.description, new.description),
      ('type', old.type_ressource, new.type_ressource),
      ('ISBN', old.isbn, new.isbn)
    ) as v(libelle, avant, apres) where v.avant is distinct from v.apres
  loop
    insert into logi_historique (objet_id, org_id, type, avant, apres, commentaire)
      values (new.id, new.org_id, 'modification', left(c.avant, 300), left(c.apres, 300), c.libelle);
  end loop;
  return new;
end $$;

create trigger logi_objets_trace_fiche after update on logi_objets
  for each row execute function logi_trace_fiche();

-- ── Droits et RLS : lecture seule pour les utilisateurs, écriture par la fonction ──
alter table logi_criteres enable row level security;
alter table logi_objets_criteres enable row level security;
alter table logi_objets_amenagements enable row level security;

create policy logi_criteres_select on logi_criteres for select to authenticated using (true);
create policy logi_objets_criteres_select on logi_objets_criteres for select to authenticated
  using (logi_est_membre(logi_org_de_objet(objet_id)));
create policy logi_objets_amenagements_select on logi_objets_amenagements for select to authenticated
  using (logi_est_membre(logi_org_de_objet(objet_id)));

revoke all on logi_criteres, logi_objets_criteres, logi_objets_amenagements from anon, authenticated, service_role;
grant select on logi_criteres, logi_objets_criteres, logi_objets_amenagements to authenticated;
grant select, insert, update, delete on logi_criteres, logi_objets_criteres, logi_objets_amenagements to service_role;

revoke all on function logi_org_de_objet(uuid) from public, anon;
revoke all on function logi_definir_criteres(uuid, uuid[], uuid[], uuid[]) from public, anon;
revoke all on function logi_trace_fiche() from public, anon, authenticated;
grant execute on function logi_org_de_objet(uuid) to authenticated;
grant execute on function logi_definir_criteres(uuid, uuid[], uuid[], uuid[]) to authenticated;

commit;
