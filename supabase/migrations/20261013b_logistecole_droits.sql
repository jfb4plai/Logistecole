-- Logistécole : rattrapage des droits (la migration initiale avait laissé les droits par défaut de Supabase).
-- Idempotent : peut être rejoué sans danger.
begin;

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

commit;
