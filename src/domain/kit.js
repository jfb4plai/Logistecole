const PRETABLE = ['bon', 'use'];

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
