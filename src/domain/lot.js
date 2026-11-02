export const MAX_LOT = 100;

export function validerLot({ nom, quantite, numeroter = false }) {
  const n = String(nom ?? '').trim();
  if (n.length === 0) return { ok: false, erreur: 'Le nom est obligatoire.' };
  if (n.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au maximum).' };
  const q = typeof quantite === 'number' ? quantite : Number(String(quantite ?? '').trim() === '' ? NaN : quantite);
  if (!Number.isInteger(q) || q < 1 || q > MAX_LOT) {
    return { ok: false, erreur: `La quantité doit être un nombre entier entre 1 et ${MAX_LOT}.` };
  }
  if (numeroter && q > 1 && n.length + 1 + String(q).length > 120) {
    return { ok: false, erreur: 'Le nom est trop long pour être numéroté (120 caractères au maximum avec le numéro).' };
  }
  return { ok: true, nom: n, quantite: q };
}

// Des exemplaires nommés pareil sont indiscernables (au retour d'un kit, par exemple) : on les numérote.
export function nomsDuLot(nom, quantite, numeroter) {
  if (!numeroter || quantite <= 1) return Array.from({ length: quantite }, () => nom);
  return Array.from({ length: quantite }, (_, i) => `${nom} ${i + 1}`);
}
