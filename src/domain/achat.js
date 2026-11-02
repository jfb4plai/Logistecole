const texte = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

function lirePrix(v) {
  const brut = texte(v);
  if (brut === null) return { valeur: null };
  let s = brut.replace(/[\s €]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '');
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) return { erreur: 'Le prix n\'est pas un nombre.' };
  if (n < 0) return { erreur: 'Le prix ne peut pas être négatif.' };
  return { valeur: Math.round(n * 100) / 100 };
}

function lireDate(v, nom) {
  const t = texte(v);
  if (t === null) return { valeur: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(new Date(`${t}T00:00:00`).getTime())) {
    return { erreur: `La ${nom} n'est pas une date valide.` };
  }
  return { valeur: t };
}

export function validerAchat(entree) {
  const erreurs = [];
  const prix = lirePrix(entree.prix_achat);
  const achat = lireDate(entree.date_achat, 'date d\'achat');
  const garantie = lireDate(entree.garantie_fin, 'fin de garantie');
  for (const r of [prix, achat, garantie]) if (r.erreur) erreurs.push(r.erreur);
  if (achat.valeur && garantie.valeur && garantie.valeur < achat.valeur) {
    erreurs.push('La fin de garantie ne peut pas être avant la date d\'achat.');
  }
  const facture = texte(entree.facture_url);
  if (facture && (!/^https?:\/\/\S+$/i.test(facture) || facture.length > 500)) {
    erreurs.push('La facture doit être une adresse http ou https.');
  }
  const limites = [['fournisseur', 120], ['financement', 120], ['numero_serie', 80]];
  const valeurs = {
    date_achat: achat.valeur ?? null,
    fournisseur: texte(entree.fournisseur),
    prix_achat: prix.valeur ?? null,
    garantie_fin: garantie.valeur ?? null,
    numero_serie: texte(entree.numero_serie),
    facture_url: facture,
    financement: texte(entree.financement),
  };
  for (const [cle, max] of limites) {
    if (valeurs[cle] && valeurs[cle].length > max) erreurs.push(`Le champ « ${cle.replace('_', ' ')} » dépasse ${max} caractères.`);
  }
  return erreurs.length ? { ok: false, erreurs, valeurs } : { ok: true, valeurs };
}
