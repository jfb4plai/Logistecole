import { describe, it, expect } from 'vitest';
import { racines, elementsDuKit, pretOuvertDe, disponibilite, verifierPretPossible } from '../../src/domain/kit.js';

const objets = [
  { id: 'K', nom: 'Valise', parent_id: null, etat: 'bon', consommable: false },
  { id: 'T1', nom: 'Tablette 1', parent_id: 'K', etat: 'bon', consommable: false },
  { id: 'T2', nom: 'Tablette 2', parent_id: 'K', etat: 'defectueux', consommable: false },
  { id: 'P', nom: 'Projecteur', parent_id: null, etat: 'bon', consommable: false },
  { id: 'C', nom: 'Piles', parent_id: null, etat: 'bon', consommable: true },
  { id: 'D', nom: 'Vieux globe', parent_id: null, etat: 'sorti', consommable: false },
];
const prets = [{ id: 'p1', objet_id: 'P', retour_le: null, emprunteur_id: 'e1', echeance: '2026-11-12' }, { id: 'p0', objet_id: 'K', retour_le: '2026-10-01T10:00:00Z' }];

describe('structure des kits', () => {
  it('ne garde que les objets de premier niveau comme racines', () => {
    expect(racines(objets).map((o) => o.id)).toEqual(['K', 'P', 'C', 'D']);
  });
  it('liste les éléments d\'un kit', () => {
    expect(elementsDuKit(objets, 'K').map((o) => o.id)).toEqual(['T1', 'T2']);
    expect(elementsDuKit(objets, 'P')).toEqual([]);
  });
  it('trouve le prêt ouvert d\'un objet, pas un prêt rendu', () => {
    expect(pretOuvertDe(prets, 'P').id).toBe('p1');
    expect(pretOuvertDe(prets, 'K')).toBeUndefined();
  });
});

describe('disponibilité', () => {
  it('disponible, prêté ou indisponible', () => {
    expect(disponibilite(objets[0], prets)).toBe('disponible');
    expect(disponibilite(objets[3], prets)).toBe('prete');
    expect(disponibilite(objets[5], prets)).toBe('indisponible');
    expect(disponibilite(objets[2], prets)).toBe('indisponible');
  });
});

describe('verifierPretPossible', () => {
  it('accepte un objet libre en bon état', () => {
    expect(verifierPretPossible(objets[0], objets, prets)).toEqual({ ok: true, exclus: ['Tablette 2'] });
  });
  it('refuse un consommable, un élément de kit, un objet prêté, hors service', () => {
    expect(verifierPretPossible(objets[4], objets, prets)).toMatchObject({ ok: false, raison: expect.stringMatching(/consommable/i) });
    expect(verifierPretPossible(objets[1], objets, prets)).toMatchObject({ ok: false, raison: expect.stringMatching(/kit/i) });
    expect(verifierPretPossible(objets[3], objets, prets)).toMatchObject({ ok: false, raison: expect.stringMatching(/déjà prêté/i) });
    expect(verifierPretPossible(objets[5], objets, prets)).toMatchObject({ ok: false, raison: expect.stringMatching(/hors service/i) });
  });
});
