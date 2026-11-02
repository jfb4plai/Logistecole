import { describe, it, expect } from 'vitest';
import { racines, elementsDuKit, pretOuvertDe, disponibilite, verifierPretPossible, pretsEnCours, trierGroupe, grouperParEtat } from '../../src/domain/kit.js';

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

describe('pretsEnCours (revue finale : un élément non rendu ne doit pas disparaître du suivi)', () => {
  const ouvert = (id, objet, groupe, parent = null) => ({ id, objet_id: objet, groupe_id: groupe, retour_le: null, logi_objets: { nom: objet, parent_id: parent } });
  it('garde un seul prêt par kit prêté : la racine', () => {
    const r = pretsEnCours([ouvert('p1', 'K', 'g1'), ouvert('p2', 'T1', 'g1', 'K'), ouvert('p3', 'T2', 'g1', 'K')]);
    expect(r.map((x) => x.id)).toEqual(['p1']);
    expect(r[0].manquant).toBe(false);
  });
  it('quand la racine est revenue sans un élément, cet élément reste visible et marqué manquant', () => {
    const r = pretsEnCours([ouvert('p3', 'T2', 'g1', 'K')]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'p3', manquant: true });
  });
  it('mélange des cas, objets seuls compris, et ignore les prêts déjà rendus', () => {
    const rendu = { ...ouvert('p9', 'X', 'g9'), retour_le: '2026-10-01T10:00:00Z' };
    const r = pretsEnCours([ouvert('p4', 'P', 'g2'), ouvert('p3', 'T2', 'g1', 'K'), rendu]);
    expect(r.map((x) => [x.id, x.manquant])).toEqual([['p4', false], ['p3', true]]);
  });
});

describe('trierGroupe (la liste de retour doit commencer par le kit, puis ses éléments dans l’ordre)', () => {
  const p = (id, nom, parent = null) => ({ id, logi_objets: { nom, parent_id: parent } });
  it('met la racine en premier puis les éléments par nom, quel que soit l’ordre reçu', () => {
    const r = trierGroupe([p('3', 'Tablette 3', 'K'), p('1', 'Tablette 1', 'K'), p('k', 'Valise'), p('2', 'Tablette 2', 'K')]);
    expect(r.map((x) => x.logi_objets.nom)).toEqual(['Valise', 'Tablette 1', 'Tablette 2', 'Tablette 3']);
  });
  it('trie les numéros dans l’ordre naturel (Tablette 2 avant Tablette 10)', () => {
    const r = trierGroupe([p('10', 'Tablette 10', 'K'), p('2', 'Tablette 2', 'K'), p('k', 'Valise')]);
    expect(r.map((x) => x.logi_objets.nom)).toEqual(['Valise', 'Tablette 2', 'Tablette 10']);
  });
  it('ne modifie pas le tableau d’origine', () => {
    const a = [p('2', 'B', 'K'), p('k', 'A')];
    trierGroupe(a);
    expect(a[0].id).toBe('2');
  });
});

describe('grouperParEtat (un appel de retour par état choisi)', () => {
  it('regroupe les prêts par état, dans l’ordre de première apparition', () => {
    const r = grouperParEtat([{ id: 'a', etat: 'neuf' }, { id: 'b', etat: 'bon' }, { id: 'c', etat: 'neuf' }, { id: 'd', etat: 'defectueux' }]);
    expect(r).toEqual([{ etat: 'neuf', ids: ['a', 'c'] }, { etat: 'bon', ids: ['b'] }, { etat: 'defectueux', ids: ['d'] }]);
  });
  it('liste vide', () => {
    expect(grouperParEtat([])).toEqual([]);
  });
});
