import { supabase } from '../lib/supabase.js';

const TABLES = ['logi_emplacements', 'logi_categories'];
function table(t) {
  if (!TABLES.includes(t)) throw new Error('Table inconnue');
  return supabase.from(t);
}
function verifier(error) {
  if (error) throw error;
}

export async function listerReferentiel(t, orgId) {
  const cols = t === 'logi_emplacements' ? 'id, nom, parent_id' : 'id, nom';
  const { data, error } = await table(t).select(cols).eq('org_id', orgId).order('nom');
  verifier(error);
  return data;
}

export async function ajouterReferentiel(t, orgId, nom, parentId = null) {
  const ligne = { org_id: orgId, nom: nom.trim() };
  if (t === 'logi_emplacements') ligne.parent_id = parentId || null;
  const { error } = await table(t).insert(ligne);
  verifier(error);
}

export async function renommerReferentiel(t, id, nom) {
  const { error } = await table(t).update({ nom: nom.trim() }).eq('id', id);
  verifier(error);
}

export async function supprimerReferentiel(t, id) {
  const { error } = await table(t).delete().eq('id', id);
  verifier(error);
}
