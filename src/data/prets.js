import { supabase } from '../lib/supabase.js';
import { lireToutesLesPages } from './pages.js';

function verifier(error) {
  if (error) throw error;
}

async function appeler(nom, args) {
  const { data, error } = await supabase.rpc(nom, args);
  verifier(error);
  return data;
}

const PRET_COLONNES =
  'id, org_id, objet_id, groupe_id, emprunteur_id, debut, echeance, retour_le, etat_retour, commentaire, '
  + 'logi_emprunteurs(libelle, type, compte_id), logi_objets(nom, code, parent_id)';

export async function listerPrets(orgId, { ouverts = false } = {}) {
  return lireToutesLesPages(async (de, a) => {
    let q = supabase.from('logi_prets').select(PRET_COLONNES).eq('org_id', orgId);
    if (ouverts) q = q.is('retour_le', null);
    const { data, error } = await q.order('echeance').order('id').range(de, a);
    verifier(error);
    return data;
  });
}

export async function listerReservations(orgId) {
  const { data, error } = await supabase
    .from('logi_reservations')
    .select('id, org_id, objet_id, emprunteur_id, debut, fin, statut, logi_emprunteurs(libelle, compte_id), logi_objets(nom, code)')
    .eq('org_id', orgId)
    .eq('statut', 'active')
    .gte('fin', new Date().toISOString())
    .order('debut');
  verifier(error);
  return data;
}

export async function listerEmprunteurs(orgId) {
  const { data, error } = await supabase
    .from('logi_emprunteurs').select('id, type, libelle, compte_id').eq('org_id', orgId).order('libelle');
  verifier(error);
  return data;
}

export async function creerEmprunteur(orgId, type, libelle) {
  const { data, error } = await supabase
    .from('logi_emprunteurs').insert({ org_id: orgId, type, libelle: libelle.trim() }).select('id, type, libelle, compte_id').single();
  verifier(error);
  return data;
}

export const emprunter = (objetId, echeance, commentaire = null) =>
  appeler('logi_emprunter', { p_objet: objetId, p_echeance: echeance, p_commentaire: commentaire });

export const preter = (objetId, emprunteurId, echeance, commentaire = null) =>
  appeler('logi_preter', { p_objet: objetId, p_emprunteur: emprunteurId, p_echeance: echeance, p_commentaire: commentaire });

// retours : [{ pret, etat, commentaire }] : un état et une remarque par prêt rendu, en un seul appel
// (la base ne signale un kit incomplet qu'une fois tous les retours enregistrés).
export const rendre = (retours, commentaire = null) => appeler('logi_rendre_detail', { p_retours: retours, p_commentaire: commentaire });

export const prolonger = (pretId, echeance) => appeler('logi_prolonger', { p_pret: pretId, p_echeance: echeance });

export const signaler = (objetId, commentaire) => appeler('logi_signaler', { p_objet: objetId, p_commentaire: commentaire });

export const reparer = (objetId, commentaire = null) => appeler('logi_reparer', { p_objet: objetId, p_commentaire: commentaire });

export const ajusterStock = (objetId, delta, commentaire = null) =>
  appeler('logi_ajuster_stock', { p_objet: objetId, p_delta: delta, p_commentaire: commentaire });

export const reserver = (objetId, debut, fin, emprunteurId = null) =>
  appeler('logi_reserver', { p_objet: objetId, p_debut: debut, p_fin: fin, p_emprunteur: emprunteurId });

export const annulerReservation = (id) => appeler('logi_annuler_reservation', { p_id: id });
