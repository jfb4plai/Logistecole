import { supabase } from '../lib/supabase.js';

function verifier(error) {
  if (error) throw error;
}

export async function listerCriteres() {
  const { data, error } = await supabase
    .from('logi_criteres').select('id, famille, code, libelle, aide, ordre').eq('actif', true).order('ordre');
  verifier(error);
  return data;
}

// Catalogue d'AménagActif lu sans copie. Les désactivés sont lus aussi : une fiche qui les a liés continue de les afficher.
export async function listerCatalogueAmenagements() {
  const [{ data: chapitres, error: e1 }, { data: amenagements, error: e2 }] = await Promise.all([
    supabase.from('ar_chapitres').select('id, ordre, titre, est_dispositif').order('ordre'),
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type, actif').order('ordre'),
  ]);
  verifier(e1);
  verifier(e2);
  return { chapitres, amenagements };
}

export async function definirCriteres(objetId, { critereIds, chapitreIds, amenagementIds }) {
  const { error } = await supabase.rpc('logi_definir_criteres', {
    p_objet: objetId, p_criteres: critereIds, p_chapitres: chapitreIds, p_amenagements: amenagementIds,
  });
  verifier(error);
}
