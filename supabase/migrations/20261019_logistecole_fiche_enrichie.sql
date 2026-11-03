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

commit;
