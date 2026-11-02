import { objets, prets, reservations, emprunteurs, jourFutur } from './store.js';

const copie = (x) => JSON.parse(JSON.stringify(x));
const obj = (id) => objets.find((o) => o.id === id);
const info = (o) => ({ nom: o.nom, code: o.code, parent_id: o.parent_id });

export const listerPrets = async (_o, opts) => copie(prets.filter((p) => !opts?.ouverts || !p.retour_le));
export const listerReservations = async () => copie(reservations.filter((r) => r.statut === 'active'));
export const listerEmprunteurs = async () => copie(emprunteurs);
export const creerEmprunteur = async (_o, type, libelle) => { const e = { id: `e${Date.now()}`, type, libelle, compte_id: null }; emprunteurs.push(e); return e; };

function creerPret(objetId, empId, echeance) {
  const o = obj(objetId);
  const groupe = `g${Date.now()}`;
  const e = emprunteurs.find((x) => x.id === empId);
  for (const x of [o, ...objets.filter((q) => q.parent_id === o.id && ['bon', 'use'].includes(q.etat))]) {
    prets.push({ id: `p${Date.now()}${x.id}`, org_id: 'o1', objet_id: x.id, groupe_id: groupe, emprunteur_id: empId, debut: new Date().toISOString(), echeance, retour_le: null, etat_retour: null, commentaire: null, logi_emprunteurs: e, logi_objets: info(x) });
  }
}
export const emprunter = async (objetId, echeance) => { creerPret(objetId, 'e-demo', echeance); };
export const preter = async (objetId, empId, echeance) => { creerPret(objetId, empId, echeance); };
export const rendre = async (ids, etat) => {
  prets.filter((p) => ids.includes(p.id)).forEach((p) => { p.retour_le = new Date().toISOString(); p.etat_retour = etat; if (etat !== 'bon') obj(p.objet_id).etat = etat; });
};
export const prolonger = async (id, echeance) => { const g = prets.find((p) => p.id === id).groupe_id; prets.filter((p) => p.groupe_id === g && !p.retour_le).forEach((p) => { p.echeance = echeance; }); };
export const signaler = async (id) => { const o = obj(id); if (['bon', 'use'].includes(o.etat)) o.etat = 'defectueux'; };
export const reparer = async (id) => { obj(id).etat = 'bon'; };
export const ajusterStock = async (id, delta) => { const o = obj(id); if (o.quantite + delta < 0) throw { code: 'P0001', message: `Stock insuffisant : il en reste ${o.quantite}` }; o.quantite += delta; return o.quantite; };
export const reserver = async (id, debut, fin) => { reservations.push({ id: `r${Date.now()}`, org_id: 'o1', objet_id: id, emprunteur_id: 'e-demo', debut, fin, statut: 'active', logi_emprunteurs: emprunteurs[0], logi_objets: info(obj(id)) }); };
export const annulerReservation = async (id) => { reservations.find((r) => r.id === id).statut = 'annulee'; };
export { jourFutur };
