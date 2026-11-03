// Catalogue d'aménagements d'AménagActif (ar_chapitres / ar_amenagements) mis en forme pour les listes à cocher.
const parOrdre = (a, b) => a.ordre - b.ordre;

export function organiserCatalogue({ chapitres = [], amenagements = [] } = {}, { dejaChoisis = [] } = {}) {
  const gardes = new Set(dejaChoisis);
  return [...chapitres].sort(parOrdre).map((c) => ({
    id: c.id,
    ordre: c.ordre,
    titre: c.titre,
    estDispositif: !!c.est_dispositif,
    items: amenagements
      .filter((a) => a.chapitre_id === c.id && (a.actif !== false || gardes.has(a.id)))
      .sort(parOrdre)
      // Un dispositif est AU ou AR selon la classe : le type stocké ne s'affiche pas.
      .map((a) => ({ id: a.id, libelle: a.libelle, etiquette: c.est_dispositif ? 'Dispositif' : a.type, desactive: a.actif === false })),
  }));
}

export const selectionVide = () => ({ chapitres: [], amenagements: [] });

export const selectionDepuisObjet = (objet) => ({
  chapitres: [...(objet?.chapitre_ids ?? [])],
  amenagements: [...(objet?.amenagement_ids ?? [])],
});

const sans = (liste, id) => liste.filter((x) => x !== id);

export function basculerChapitre(sel, chapitre) {
  if (sel.chapitres.includes(chapitre.id)) return { ...sel, chapitres: sans(sel.chapitres, chapitre.id) };
  const detail = new Set(chapitre.items.map((i) => i.id));
  return { chapitres: [...sel.chapitres, chapitre.id], amenagements: sel.amenagements.filter((id) => !detail.has(id)) };
}

export function basculerAmenagement(sel, chapitre, amenagementId) {
  if (sel.chapitres.includes(chapitre.id)) return sel;
  return sel.amenagements.includes(amenagementId)
    ? { ...sel, amenagements: sans(sel.amenagements, amenagementId) }
    : { ...sel, amenagements: [...sel.amenagements, amenagementId] };
}

export function resumeChapitre(sel, chapitre) {
  const total = chapitre.items.length;
  const entier = sel.chapitres.includes(chapitre.id);
  const choisis = entier ? total : chapitre.items.filter((i) => sel.amenagements.includes(i.id)).length;
  return { entier, choisis, total };
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function libelleSelection(sel) {
  const parts = [];
  if (sel.chapitres.length) parts.push(pluriel(sel.chapitres.length, 'chapitre'));
  if (sel.amenagements.length) parts.push(pluriel(sel.amenagements.length, 'aménagement'));
  return parts.length ? parts.join(', ') : 'Aucun';
}

export function chapitreDeAmenagement(catalogue) {
  return new Map(catalogue.flatMap((c) => c.items.map((i) => [i.id, c.id])));
}
