export const MAX_LOT = 100;

export function validerLot({ nom, quantite }) {
  const n = String(nom ?? '').trim();
  if (n.length === 0) return { ok: false, erreur: 'Le nom est obligatoire.' };
  if (n.length > 120) return { ok: false, erreur: 'Le nom est trop long (120 caractères au maximum).' };
  const q = typeof quantite === 'number' ? quantite : Number(String(quantite ?? '').trim() === '' ? NaN : quantite);
  if (!Number.isInteger(q) || q < 1 || q > MAX_LOT) {
    return { ok: false, erreur: `La quantité doit être un nombre entier entre 1 et ${MAX_LOT}.` };
  }
  return { ok: true, nom: n, quantite: q };
}
