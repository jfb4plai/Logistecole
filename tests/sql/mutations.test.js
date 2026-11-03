// @vitest-environment node
import { it, expect } from 'vitest';
import * as H from './harness.js';

const mutations = [
  ['isolation des prêts supprimée', (s) => s.replace("using (logi_a_role(org_id, array['admin', 'gestionnaire', 'lecture']) or logi_est_emprunteur_moi(emprunteur_id));", 'using (true);')],
  ['unicité du prêt ouvert supprimée', (s) => s.replace('create unique index logi_prets_un_seul_ouvert on logi_prets (objet_id) where retour_le is null;', '')],
  ['contrôle de propriétaire au retour supprimé', (s) => s.replace("and not logi_est_emprunteur_moi(pr.emprunteur_id) then\n      raise exception 'Vous ne pouvez rendre", "and false then\n      raise exception 'Vous ne pouvez rendre")],
  ['contrôle de propriétaire à la prolongation supprimé', (s) => s.replace("and not logi_est_emprunteur_moi(pr.emprunteur_id) then\n    raise exception 'Vous ne pouvez prolonger", "and false then\n    raise exception 'Vous ne pouvez prolonger")],
  ['contrôle de chevauchement des réservations supprimé', (s) => s.replace("raise exception 'Ce créneau est déjà réservé';", "null;")],
  ['stock négatif autorisé', (s) => s.replace("if v_q < 0 then raise exception", "if false then raise exception")],
];

// Mutations de la migration 20261019 : chacune doit faire échouer supabase/tests/logistecole_fiche.sql.
const mutationsFiche = [
  ['contrôle de rôle de logi_definir_criteres supprimé', (s) => s.replace("if v_org is null or not logi_a_role(v_org, array['admin', 'gestionnaire']) then", 'if v_org is null then')],
  ['organisation de l\'objet ignorée', (s) => s.replace('v_org := logi_org_de_objet(p_objet);', 'v_org := (select org_id from logi_membres where user_id = auth.uid() limit 1);')],
  ['exactement un de chapitre/aménagement supprimé', (s) => s.replace('check (num_nonnulls(chapitre_id, amenagement_id) = 1)', 'check (true)')],
  ['clé ISBN-13 non contrôlée', (s) => s.replace('return (10 - s % 10) % 10 = substr(p, 13, 1)::int;', 'return true;')],
  ['trigger de refus des prêts numériques retiré', (s) => s.replace('create trigger logi_prets_refuser_numerique before insert on logi_prets\n  for each row execute function logi_refuser_numerique();', '')],
  ['aménagement désactivé accepté', (s) => s.replace('if exists (select 1 from ar_amenagements a where a.id = any (v_amgt) and not a.actif', 'if false and exists (select 1 from ar_amenagements a where a.id = any (v_amgt) and not a.actif')],
  ['lecture des critères ouverte à tous', (s) => s.replace('create policy logi_objets_criteres_select on logi_objets_criteres for select to authenticated\n  using (logi_est_membre(logi_org_de_objet(objet_id)));', 'create policy logi_objets_criteres_select on logi_objets_criteres for select to authenticated\n  using (true);')],
];

for (const [nom, muter] of mutationsFiche) {
  it(`mutation détectée (fiche) : ${nom}`, async () => {
    const db = await H.creerBase(H.migrations().filter((f) => f < '20261019'));
    // Git sous Windows peut réécrire les fins de ligne en CRLF : les fragments à muter sont écrits avec des \n.
    const original = H.lireFichier('supabase/migrations/20261019_logistecole_fiche_enrichie.sql').replace(/\r\n/g, '\n');
    const muté = muter(original);
    expect(muté).not.toBe(original);
    await db.exec(muté);
    await expect(H.executerScript(db, 'supabase/tests/logistecole_fiche.sql')).rejects.toThrow();
  }, 120000);
}

for (const [nom, muter] of mutations) {
  it(`mutation détectée : ${nom}`, async () => {
    const db = await H.creerBase(['20261013_logistecole_core.sql', '20261013b_logistecole_droits.sql']);
    const original = H.lireFichier('supabase/migrations/20261014_logistecole_prets.sql');
    const muté = muter(original);
    expect(muté).not.toBe(original);
    await db.exec(muté);
    await expect(H.executerScript(db, 'supabase/tests/logistecole_prets.sql')).rejects.toThrow();
  }, 120000);
}
