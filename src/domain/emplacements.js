const SEPARATEUR = ' › ';

// Chemin complet de chaque emplacement (« Salle 12 › Armoire A »), trié : deux « Armoire A »
// dans deux salles doivent rester distinguables partout où on choisit ou affiche un emplacement.
export function cheminsEmplacements(emplacements) {
  const parId = new Map((emplacements ?? []).map((e) => [e.id, e]));
  const chemin = (e) => {
    const noms = [e.nom];
    const vus = new Set([e.id]);
    let courant = e;
    while (courant.parent_id && parId.has(courant.parent_id) && !vus.has(courant.parent_id) && noms.length < 10) {
      courant = parId.get(courant.parent_id);
      vus.add(courant.id);
      noms.unshift(courant.nom);
    }
    return noms.join(SEPARATEUR);
  };
  return (emplacements ?? [])
    .map((e) => ({ id: e.id, nom: e.nom, parent_id: e.parent_id ?? null, chemin: chemin(e) }))
    .sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr'));
}

export function cheminDe(emplacements, id) {
  if (!id) return null;
  return cheminsEmplacements(emplacements).find((e) => e.id === id)?.chemin ?? null;
}
