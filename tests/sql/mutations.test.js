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
