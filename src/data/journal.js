import { supabase } from '../lib/supabase.js';
import { TAILLE_PAGE_JOURNAL } from '../domain/journal.js';

// Les événements de toute l'organisation, du plus récent au plus ancien ; `apres` = identifiant du dernier lu.
export async function listerJournal(orgId, apres = null) {
  let q = supabase
    .from('logi_historique')
    .select('id, objet_id, type, avant, apres, commentaire, quand, auteur_email, logi_objets(nom, code)')
    .eq('org_id', orgId)
    .order('id', { ascending: false })
    .limit(TAILLE_PAGE_JOURNAL);
  if (apres) q = q.lt('id', apres);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
