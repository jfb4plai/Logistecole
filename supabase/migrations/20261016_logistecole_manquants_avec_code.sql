-- Au retour partiel d'un kit, l'historique nomme l'élément manquant avec son code court (des exemplaires peuvent porter le même nom).
begin;

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

commit;
