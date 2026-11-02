import { categories, emplacements } from './store.js';

const liste = (t) => (t === 'logi_categories' ? categories : emplacements);
export const listerReferentiel = async (t) => JSON.parse(JSON.stringify(liste(t)));
export const ajouterReferentiel = async (t, _o, nom, parentId = null) => { liste(t).push({ id: `x${Date.now()}`, nom, parent_id: parentId }); };
export const renommerReferentiel = async (t, id, nom) => { liste(t).find((x) => x.id === id).nom = nom; };
export const supprimerReferentiel = async (t, id) => { const l = liste(t); l.splice(l.findIndex((x) => x.id === id), 1); };
