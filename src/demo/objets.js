import { objets, historique } from './store.js';

const copie = (x) => JSON.parse(JSON.stringify(x));

export const listerObjets = async () => copie(objets);
export const getObjetParCode = async (code) => copie(objets.find((o) => o.code === code) ?? null);
export const listerHistorique = async () => copie(historique);
export const urlsPhotos = async () => ({});
export const modifierObjet = async (id, champs) => { Object.assign(objets.find((o) => o.id === id), champs); };
export const supprimerObjet = async (id) => { objets.splice(objets.findIndex((o) => o.id === id), 1); };
export const ajouterEntreeHistorique = async ({ type, commentaire }) => {
  historique.unshift({ id: Date.now(), type, avant: null, apres: null, commentaire, quand: new Date().toISOString(), auteur_email: 'demo@ecole.be' });
};
export const creerObjets = async (_org, lot) => {
  lot.forEach((l, i) => objets.push({ id: `n${Date.now()}${i}`, org_id: 'o1', etat: 'bon', logi_categories: { nom: '—' }, logi_emplacements: { nom: null }, liens: [], ...l }));
  return lot.map((l, i) => ({ objet_id: `n${i}`, objet_code: l.code }));
};
export const uploaderPhoto = async () => 'demo/photo.jpg';
export const supprimerPhoto = async () => {};
