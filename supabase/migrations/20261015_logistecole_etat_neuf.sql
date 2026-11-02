-- Logistécole : nouvel état « neuf » (objet jamais utilisé), prêtable et réservable comme « bon » ou « usé ».
-- Se déclare à la création ou en corrigeant l'état ; jamais au retour d'un prêt.
begin;

alter table logi_objets drop constraint logi_objets_etat_check;
alter table logi_objets add constraint logi_objets_etat_check
  check (etat in ('neuf', 'bon', 'use', 'defectueux', 'perdu', 'sorti'));

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
    || case when v_exclus > 0 then ' (sans ' || v_exclus || ' élément(s) hors service ou déjà sorti(s))' else '' end
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

create or replace function logi_signaler(p_objet uuid, p_commentaire text) returns void
language plpgsql security definer set search_path = public as $$
declare o logi_objets%rowtype;
begin
  select * into o from logi_objets where id = p_objet;
  if not found or logi_role_dans(o.org_id) is null then
    raise exception 'Vous n''avez pas le droit de signaler ce matériel' using errcode = '42501';
  end if;
  if o.etat in ('neuf', 'bon', 'use') then update logi_objets set etat = 'defectueux' where id = o.id; end if;
  insert into logi_historique (objet_id, org_id, type, commentaire) values (o.id, o.org_id, 'panne', p_commentaire);
end $$;

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
  if o.etat not in ('neuf', 'bon', 'use') then raise exception 'Cet objet est hors service ou sorti : il ne peut pas être réservé'; end if;
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
    values (o.id, o.org_id, 'reservation', v_libelle, 'du ' || to_char(p_debut at time zone 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') || ' au ' || to_char(p_fin at time zone 'Europe/Brussels', 'DD/MM/YYYY HH24:MI'));
  return v_id;
end $$;

commit;
