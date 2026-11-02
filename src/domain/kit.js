import { ETATS_PRETABLES as PRETABLE } from './etats.js';

export const racines = (objets) => objets.filter((o) => !o.parent_id);
export const elementsDuKit = (objets, parentId) => objets.filter((o) => o.parent_id === parentId);
export const pretOuvertDe = (prets, objetId) => prets.find((p) => p.objet_id === objetId && !p.retour_le);

export function disponibilite(objet, prets) {
  if (pretOuvertDe(prets, objet.id)) return 'prete';
  return PRETABLE.includes(objet.etat) ? 'disponible' : 'indisponible';
}

// Même règles que la base ; la base reste l'autorité, ceci évite un aller-retour inutile.
export function verifierPretPossible(objet, objets, prets) {
  if (objet.consommable) return { ok: false, raison: 'Un consommable ne se prête pas : ajustez le stock.' };
  if (objet.parent_id) return { ok: false, raison: 'Cet objet fait partie d\'un kit : prêtez le kit entier.' };
  if (pretOuvertDe(prets, objet.id)) return { ok: false, raison: 'Cet objet est déjà prêté.' };
  if (!PRETABLE.includes(objet.etat)) return { ok: false, raison: 'Cet objet est hors service ou sorti.' };
  const exclus = elementsDuKit(objets, objet.id)
    .filter((e) => !PRETABLE.includes(e.etat) || pretOuvertDe(prets, e.id))
    .map((e) => e.nom);
  return { ok: true, exclus };
}

// Prêts à suivre : un seul par kit (la racine). Si la racine est revenue mais pas un élément,
// l'élément reste visible, marqué « manquant », pour ne pas disparaître du suivi.
export function pretsEnCours(prets) {
  const ouverts = prets.filter((p) => !p.retour_le);
  const groupesAvecRacine = new Set(ouverts.filter((p) => !p.logi_objets?.parent_id).map((p) => p.groupe_id));
  const resultat = [];
  for (const p of ouverts) {
    if (!p.logi_objets?.parent_id) resultat.push({ ...p, manquant: false });
    else if (!groupesAvecRacine.has(p.groupe_id)) resultat.push({ ...p, manquant: true });
  }
  return resultat;
}

// Liste de retour : le kit d'abord, puis ses éléments dans l'ordre naturel (Tablette 2 avant Tablette 10).
export function trierGroupe(prets) {
  return [...prets].sort((a, b) => {
    const ra = a.logi_objets?.parent_id ? 1 : 0;
    const rb = b.logi_objets?.parent_id ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return String(a.logi_objets?.nom ?? '').localeCompare(String(b.logi_objets?.nom ?? ''), 'fr', { numeric: true });
  });
}
