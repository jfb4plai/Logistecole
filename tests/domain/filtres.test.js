import { describe, it, expect } from 'vitest';
import { filtrerObjets } from '../../src/domain/filtres.js';

const objets = [
  { id: 1, nom: 'Valise de tablettes', code: 'AAAA2222', etat: 'bon', categorie_id: 'c1', emplacement_id: 'e1', notes: '16 iPad' },
  { id: 2, nom: 'Projecteur numérique', code: 'BBBB3333', etat: 'defectueux', categorie_id: 'c2', emplacement_id: 'e2', notes: null },
  { id: 3, nom: 'Vieux globe', code: 'CCCC4444', etat: 'sorti', categorie_id: 'c2', emplacement_id: null, notes: null },
];

describe('filtrerObjets', () => {
  it('cache les objets sortis par défaut', () => {
    expect(filtrerObjets(objets).map((o) => o.id)).toEqual([1, 2]);
  });
  it('montre les sortis quand on les demande', () => {
    expect(filtrerObjets(objets, { etat: 'sorti' }).map((o) => o.id)).toEqual([3]);
  });
  it('cherche sans tenir compte des accents ni de la casse, dans nom, code et notes', () => {
    expect(filtrerObjets(objets, { q: 'NUMERIQUE' }).map((o) => o.id)).toEqual([2]);
    expect(filtrerObjets(objets, { q: 'tablettes' }).map((o) => o.id)).toEqual([1]);
    expect(filtrerObjets(objets, { q: 'ipad' }).map((o) => o.id)).toEqual([1]);
    expect(filtrerObjets(objets, { q: 'bbbb-3333' }).map((o) => o.id)).toEqual([2]);
  });
  it('combine catégorie et emplacement', () => {
    expect(filtrerObjets(objets, { categorieId: 'c2' }).map((o) => o.id)).toEqual([2]);
    expect(filtrerObjets(objets, { emplacementId: 'e1' }).map((o) => o.id)).toEqual([1]);
  });
});
