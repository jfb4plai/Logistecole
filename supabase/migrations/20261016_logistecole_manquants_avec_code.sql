-- Au retour partiel d'un kit, l'historique nomme l'élément manquant avec son code court (des exemplaires peuvent porter le même nom).
-- Et le prêt d'un kit dit « déjà prêté(s) » (et non « déjà sorti(s) », qui désigne le rebut) pour les éléments laissés de côté.
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
  -- Même verrou que logi_reserver : un prêt et une réservation ne se croisent pas en parallèle.
  perform pg_advisory_xact_lock(hashtext(o.id::text));
  if o.consommable then raise exception 'Un consommable ne se prête pas : ajustez le stock'; end if;
  if o.parent_id is not null then raise exception 'Cet objet fait partie d''un kit : prêtez le kit entier'; end if;
  if o.etat not in ('neuf', 'bon', 'use') then raise exception 'Cet objet est hors service ou sorti : il ne peut pas être prêté'; end if;
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
      and (c.etat not in ('neuf', 'bon', 'use') or exists (select 1 from logi_prets p where p.objet_id = c.id and p.retour_le is null));

  v_texte := 'jusqu''au ' || to_char(p_echeance, 'DD/MM/YYYY')
    || case when v_exclus > 0 then ' (sans ' || v_exclus || ' élément(s) hors service ou déjà prêté(s))' else '' end
    || coalesce(' : ' || p_commentaire, '');

  begin
    insert into logi_prets (org_id, objet_id, groupe_id, emprunteur_id, echeance, commentaire)
      values (o.org_id, o.id, v_groupe, e.id, p_echeance, p_commentaire);
    insert into logi_historique (objet_id, org_id, type, apres, commentaire) values (o.id, o.org_id, 'pret', e.libelle, v_texte);
    for el in select * from logi_objets c where c.parent_id = o.id order by c.nom loop
      if el.etat in ('neuf', 'bon', 'use') and not exists (select 1 from logi_prets p where p.objet_id = el.id and p.retour_le is null) then
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

commit;
