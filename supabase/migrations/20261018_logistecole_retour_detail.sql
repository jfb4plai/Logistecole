-- Retour d'un prêt : un seul appel avec un état et une remarque PAR ÉLÉMENT.
-- Corrige deux défauts de 20261017 : un retour en plusieurs appels (un par état) écrivait de faux
-- constats « Rendu incomplet », et la remarque unique était copiée sur tous les éléments rendus.
-- logi_rendre (un seul état pour tous) est conservée : elle appelle la nouvelle fonction.
begin;

create or replace function logi_rendre_detail(p_retours jsonb, p_commentaire text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; pr logi_prets%rowtype; v_groupe uuid; v_manque text; v_racine uuid;
  v_actuel text; v_ids uuid[]; v_trouves int;
begin
  if p_retours is null or jsonb_typeof(p_retours) <> 'array' or jsonb_array_length(p_retours) = 0 then
    raise exception 'Aucun prêt à rendre';
  end if;
  if jsonb_array_length(p_retours) > 200 then
    raise exception 'Trop de retours à la fois (200 au plus)';
  end if;
  select array_agg((e ->> 'pret')::uuid) into v_ids from jsonb_array_elements(p_retours) e;
  select count(*) into v_trouves from logi_prets where id = any (v_ids) and retour_le is null;
  if v_trouves <> array_length(v_ids, 1) or v_trouves <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'Un des prêts est introuvable, déjà rendu ou en double';
  end if;

  -- Tous les contrôles avant la moindre écriture (la fonction est atomique : une erreur annule tout).
  for r in select (e ->> 'pret')::uuid as pret_id, e ->> 'etat' as etat from jsonb_array_elements(p_retours) e loop
    if r.etat is null or r.etat not in ('neuf', 'bon', 'use', 'defectueux', 'perdu') then
      raise exception 'État de retour invalide';
    end if;
    select * into pr from logi_prets where id = r.pret_id;
    if coalesce(logi_role_dans(pr.org_id), '') not in ('admin', 'gestionnaire') and not logi_est_emprunteur_moi(pr.emprunteur_id) then
      raise exception 'Vous ne pouvez rendre que vos propres prêts' using errcode = '42501';
    end if;
    select etat into v_actuel from logi_objets where id = pr.objet_id;
    if logi_rang_etat(r.etat) > logi_rang_etat(v_actuel) then
      raise exception 'Un objet ne s''améliore pas au retour : il est « % » et ne peut pas revenir « % »', v_actuel, r.etat;
    end if;
  end loop;

  for r in select (e ->> 'pret')::uuid as pret_id, e ->> 'etat' as etat,
                  coalesce(nullif(e ->> 'commentaire', ''), p_commentaire) as com
           from jsonb_array_elements(p_retours) e loop
    select * into pr from logi_prets where id = r.pret_id;
    update logi_prets set retour_le = now(), etat_retour = r.etat, commentaire_retour = r.com, retour_par = auth.uid() where id = pr.id;
    update logi_objets set etat = r.etat where id = pr.objet_id and etat is distinct from r.etat;
    insert into logi_historique (objet_id, org_id, type, apres, commentaire) values (pr.objet_id, pr.org_id, 'retour', r.etat, r.com);
  end loop;

  -- Un seul constat d'incomplétude par kit, une fois tous les retours de cet appel enregistrés.
  for v_groupe in select distinct groupe_id from logi_prets where id = any (v_ids) loop
    select string_agg(o.nom || ' (' || o.code || ')', ', ' order by o.nom, o.code) into v_manque
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

create or replace function logi_rendre(p_prets uuid[], p_etat text default 'bon', p_commentaire text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_prets is null or coalesce(array_length(p_prets, 1), 0) = 0 then
    raise exception 'Aucun prêt à rendre';
  end if;
  perform logi_rendre_detail((select jsonb_agg(jsonb_build_object('pret', x, 'etat', p_etat)) from unnest(p_prets) x), p_commentaire);
end $$;

revoke all on function logi_rendre_detail(jsonb, text) from public, anon;
grant execute on function logi_rendre_detail(jsonb, text) to authenticated;

commit;
