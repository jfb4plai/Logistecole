const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrerObjets(objets, { q = '', categorieId = '', emplacementId = '', etat = '' } = {}) {
  const n = sansAccent(q).trim();
  const nCode = n.replace(/[\s-]/g, '');
  return objets.filter((o) => {
    if (etat ? o.etat !== etat : o.etat === 'sorti') return false;
    if (categorieId && o.categorie_id !== categorieId) return false;
    if (emplacementId && o.emplacement_id !== emplacementId) return false;
    if (n) {
      const texte = sansAccent(`${o.nom} ${o.code} ${o.notes ?? ''}`);
      if (!texte.includes(n) && !(nCode && sansAccent(o.code).includes(nCode))) return false;
    }
    return true;
  });
}
