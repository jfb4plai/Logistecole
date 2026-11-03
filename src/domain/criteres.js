export const TYPES_RESSOURCE = [
  { value: 'physique', label: 'Physique' },
  { value: 'numerique', label: 'Numérique' },
  { value: 'les_deux', label: 'Les deux' },
];

export const MENTION_INDICATIVE = 'Étiquettes indicatives posées par l\'équipe, pas une prescription.';

const FAMILLES = [
  ['trouble', 'autre_trouble', 'Troubles'],
  ['difficulte', 'autre_difficulte', 'Difficultés d\'apprentissage'],
  ['amenagement', 'autre_amenagement', 'Aménagements'],
];
const MAX = 500;

export const autresVides = () => ({
  trouble: { coche: false, texte: '' },
  difficulte: { coche: false, texte: '' },
  amenagement: { coche: false, texte: '' },
});

export function autresDepuisObjet(objet) {
  const autres = autresVides();
  for (const [famille, colonne] of FAMILLES) {
    const texte = objet?.[colonne] ?? '';
    autres[famille] = { coche: texte.trim() !== '', texte };
  }
  return autres;
}

// « Autre » coché exige un texte ; décoché, le texte restant est ignoré.
export function validerAutres(autres) {
  const valeurs = {};
  const erreurs = [];
  for (const [famille, colonne, libelle] of FAMILLES) {
    const { coche, texte } = autres[famille];
    const t = String(texte ?? '').trim();
    if (!coche) { valeurs[colonne] = null; continue; }
    if (!t) erreurs.push(`« Autre » est coché dans « ${libelle} » : décrivez-le, ou décochez-le.`);
    else if (t.length > MAX) erreurs.push(`« Autre » dans « ${libelle} » : ${MAX} caractères au maximum.`);
    valeurs[colonne] = t;
  }
  return erreurs.length ? { ok: false, erreurs } : { ok: true, valeurs };
}
