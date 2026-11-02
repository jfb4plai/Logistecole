import { libelleEvenement } from './historique.js';
import { dateIso, dateLongue } from './echeance.js';

// Nombre d'événements lus par requête ; au-delà, « Charger plus ».
export const TAILLE_PAGE_JOURNAL = 200;

export const CATEGORIES_JOURNAL = [
  { value: '', label: 'Tout' },
  { value: 'prets', label: 'Prêts et retours', types: ['pret', 'retour', 'retour_partiel'] },
  { value: 'reservations', label: 'Réservations', types: ['reservation'] },
  { value: 'pannes', label: 'Pannes et réparations', types: ['panne', 'reparation'] },
  { value: 'etats', label: 'États et déplacements', types: ['etat', 'deplacement'] },
  { value: 'stock', label: 'Stock', types: ['stock'] },
  { value: 'fiches', label: 'Créations, modifications, achats', types: ['creation', 'modification', 'achat'] },
  { value: 'notes', label: 'Notes et corrections', types: ['correction', 'note'] },
];

const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrerJournal(evenements, { categorie = '', q = '' } = {}) {
  const types = CATEGORIES_JOURNAL.find((c) => c.value === categorie)?.types;
  const n = sansAccent(q).trim();
  const nCode = n.replace(/[\s-]/g, '');
  return evenements.filter((e) => {
    if (types && !types.includes(e.type)) return false;
    if (!n) return true;
    const texte = sansAccent(`${e.logi_objets?.nom ?? ''} ${e.auteur_email ?? ''} ${libelleEvenement(e)}`);
    return texte.includes(n) || (!!nCode && sansAccent(e.logi_objets?.code).includes(nCode));
  });
}

// Du plus récent au plus ancien, par jour calendaire local.
export function grouperParJour(evenements, now = new Date()) {
  const aujourdhui = dateIso(now);
  const hier = dateIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const jours = new Map();
  for (const e of evenements) {
    const j = dateIso(new Date(e.quand));
    if (!jours.has(j)) jours.set(j, []);
    jours.get(j).push(e);
  }
  return [...jours]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([jour, evts]) => ({
      jour,
      libelle: jour === aujourdhui ? 'Aujourd’hui' : jour === hier ? 'Hier' : dateLongue(jour),
      evenements: evts,
    }));
}
