import { supabase } from '../lib/supabase.js';

const COLONNES =
  'id, org_id, nom, code, etat, notes, photo_path, categorie_id, emplacement_id, cree_le, maj_le, logi_categories(nom), logi_emplacements(nom)';
const BUCKET = 'logi-photos';

function verifier(error) {
  if (error) throw error;
}

export async function listerObjets(orgId) {
  const { data, error } = await supabase.from('logi_objets').select(COLONNES).eq('org_id', orgId).order('nom');
  verifier(error);
  return data;
}

export async function getObjetParCode(code) {
  const { data, error } = await supabase.from('logi_objets').select(COLONNES).eq('code', code).maybeSingle();
  verifier(error);
  return data;
}

export async function creerObjets(orgId, objets) {
  const { data, error } = await supabase.rpc('logi_creer_objets', { p_org: orgId, p_objets: objets });
  verifier(error);
  return data;
}

export async function modifierObjet(id, champs) {
  const { error } = await supabase.from('logi_objets').update(champs).eq('id', id);
  verifier(error);
}

export async function supprimerObjet(id) {
  const { error } = await supabase.from('logi_objets').delete().eq('id', id);
  verifier(error);
}

export async function listerHistorique(objetId) {
  const { data, error } = await supabase
    .from('logi_historique')
    .select('id, type, avant, apres, commentaire, quand, auteur_email')
    .eq('objet_id', objetId)
    .order('quand', { ascending: false })
    .order('id', { ascending: false });
  verifier(error);
  return data;
}

export async function ajouterEntreeHistorique({ objetId, orgId, type, commentaire }) {
  const { error } = await supabase
    .from('logi_historique')
    .insert({ objet_id: objetId, org_id: orgId, type, commentaire });
  verifier(error);
}

export async function uploaderPhoto(orgId, blob) {
  const path = `${orgId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  verifier(error);
  return path;
}

export async function supprimerPhoto(path) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function urlsPhotos(paths) {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  verifier(error);
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
