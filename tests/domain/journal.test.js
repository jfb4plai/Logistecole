import { describe, it, expect } from 'vitest';
import { CATEGORIES_JOURNAL, filtrerJournal, grouperParJour } from '../../src/domain/journal.js';

const ev = (id, type, quand, extra = {}) => ({ id, type, quand, avant: null, apres: null, commentaire: null, auteur_email: 'jf@ecole.be', logi_objets: { nom: 'Valise de tablettes', code: 'KKKK2222' }, ...extra });
const evts = [
  ev(5, 'pret', '2026-11-02T18:00:00Z', { apres: 'M.D.', commentaire: 'jusqu’au 09/11/2026' }),
  ev(4, 'panne', '2026-11-02T10:00:00Z', { commentaire: 'écran noir', logi_objets: { nom: 'Projecteur', code: 'PPPP2222' } }),
  ev(3, 'retour', '2026-11-01T09:00:00Z', { apres: 'bon' }),
  ev(2, 'stock', '2026-10-30T09:00:00Z', { avant: '10', apres: '7', logi_objets: { nom: 'Piles AA', code: 'CCCC2222' } }),
  ev(1, 'creation', '2026-10-30T08:00:00Z', { apres: 'Valise de tablettes' }),
];

describe('CATEGORIES_JOURNAL', () => {
  it('couvre tous les types d’événements, chacun dans une seule catégorie', () => {
    const tous = ['creation', 'deplacement', 'etat', 'modification', 'correction', 'note', 'achat', 'pret', 'retour', 'retour_partiel', 'panne', 'reparation', 'stock', 'reservation'];
    const vus = CATEGORIES_JOURNAL.flatMap((c) => c.types ?? []);
    expect([...vus].sort()).toEqual([...tous].sort());
    expect(new Set(vus).size).toBe(vus.length);
  });
});

describe('filtrerJournal', () => {
  it('sans filtre, garde tout', () => {
    expect(filtrerJournal(evts, {})).toHaveLength(5);
  });
  it('filtre par catégorie', () => {
    expect(filtrerJournal(evts, { categorie: 'prets' }).map((e) => e.id)).toEqual([5, 3]);
    expect(filtrerJournal(evts, { categorie: 'pannes' }).map((e) => e.id)).toEqual([4]);
  });
  it('cherche dans le nom de l’objet, le code, l’emprunteur et le commentaire, sans accent ni casse', () => {
    expect(filtrerJournal(evts, { q: 'projecteur' }).map((e) => e.id)).toEqual([4]);
    expect(filtrerJournal(evts, { q: 'cccc-2222' }).map((e) => e.id)).toEqual([2]);
    expect(filtrerJournal(evts, { q: 'm.d.' }).map((e) => e.id)).toEqual([5]);
    expect(filtrerJournal(evts, { q: 'ECRAN' }).map((e) => e.id)).toEqual([4]);
  });
  it('combine catégorie et recherche', () => {
    expect(filtrerJournal(evts, { categorie: 'prets', q: 'valise' }).map((e) => e.id)).toEqual([5, 3]);
    expect(filtrerJournal(evts, { categorie: 'pannes', q: 'valise' })).toEqual([]);
  });
});

describe('grouperParJour', () => {
  const now = new Date('2026-11-02T20:00:00');
  it('regroupe par jour, du plus récent au plus ancien, avec des libellés lisibles', () => {
    const r = grouperParJour(evts, now);
    expect(r.map((g) => g.libelle)).toEqual(['Aujourd’hui', 'Hier', 'vendredi 30 octobre']);
    expect(r[0].evenements.map((e) => e.id)).toEqual([5, 4]);
    expect(r[2].evenements.map((e) => e.id)).toEqual([2, 1]);
  });
  it('liste vide', () => {
    expect(grouperParJour([], now)).toEqual([]);
  });
});
