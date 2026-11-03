const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Les chapitres et les détails du catalogue AménagActif forment une seule famille (OU) :
// un chapitre inclut ses détails, donc chaque côté trouve l'autre.
function correspondAmenagements(o, chapitreIds, amenagementIds, chapitreDeAmenagement) {
  const liesChapitres = o.chapitre_ids ?? [];
  const liesDetails = o.amenagement_ids ?? [];
  return chapitreIds.some((c) => liesChapitres.includes(c) || liesDetails.some((a) => chapitreDeAmenagement.get(a) === c))
    || amenagementIds.some((a) => liesDetails.includes(a) || liesChapitres.includes(chapitreDeAmenagement.get(a)));
}

export function filtrerObjets(objets, filtres = {}, contexte = {}) {
  const {
    q = '', categorieId = '', emplacementId = '', etat = '', type = '',
    critereIds = [], chapitreIds = [], amenagementIds = [],
  } = filtres;
  const { criteres = [], chapitreDeAmenagement = new Map() } = contexte;
  const n = sansAccent(q).trim();
  const nCode = n.replace(/[\s-]/g, '');

  // Critères cochés, regroupés par famille : OU dans la famille, ET entre familles.
  const familleDe = new Map(criteres.map((c) => [c.id, c.famille]));
  const groupes = new Map();
  for (const id of critereIds) {
    const f = familleDe.get(id) ?? 'autre';
    groupes.set(f, [...(groupes.get(f) ?? []), id]);
  }

  return objets.filter((o) => {
    if (etat ? o.etat !== etat : o.etat === 'sorti') return false;
    if (categorieId && o.categorie_id !== categorieId) return false;
    if (emplacementId && o.emplacement_id !== emplacementId) return false;
    const t = o.type_ressource ?? 'physique';
    if (type === 'physique' && t === 'numerique') return false;
    if (type === 'numerique' && t === 'physique') return false;
    for (const ids of groupes.values()) {
      if (!ids.some((id) => (o.critere_ids ?? []).includes(id))) return false;
    }
    if ((chapitreIds.length || amenagementIds.length)
      && !correspondAmenagements(o, chapitreIds, amenagementIds, chapitreDeAmenagement)) return false;
    if (n) {
      const texte = sansAccent(`${o.nom} ${o.code} ${o.notes ?? ''} ${o.auteur ?? ''} ${o.editeur ?? ''} ${o.description ?? ''} `
        + `${o.autre_trouble ?? ''} ${o.autre_difficulte ?? ''} ${o.autre_amenagement ?? ''}`);
      const parCode = nCode && (sansAccent(o.code).includes(nCode) || String(o.isbn ?? '').includes(nCode));
      if (!texte.includes(n) && !parCode) return false;
    }
    return true;
  });
}
