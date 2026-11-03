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

describe('filtrerObjets : fiche enrichie', () => {
  const base = { etat: 'bon', categorie_id: 'c1', emplacement_id: null, notes: null, code: 'ZZZZ2222' };
  const criteres = [
    { id: 'k-dys', famille: 'trouble' }, { id: 'k-tdah', famille: 'trouble' },
    { id: 'k-lec', famille: 'difficulte' },
  ];
  const chapitreDeAmenagement = new Map([['a1', 'ch1'], ['a2', 'ch1'], ['a9', 'ch2']]);
  const ctx = { criteres, chapitreDeAmenagement };
  const livre = { ...base, id: 'L', nom: 'Les neurones de la lecture', code: 'LLLL2222', auteur: 'Stanislas Dehaene', editeur: 'Odile Jacob', isbn: '9782738119742', type_ressource: 'physique', critere_ids: ['k-dys', 'k-lec'], chapitre_ids: [], amenagement_ids: ['a1'] };
  const site = { ...base, id: 'S', nom: 'Site de lecture', code: 'SSSS2222', type_ressource: 'numerique', description: 'Exercices en ligne', autre_trouble: 'élèves allophones', critere_ids: ['k-tdah'], chapitre_ids: ['ch2'], amenagement_ids: [] };
  const mixte = { ...base, id: 'M', nom: 'Appli et boîte', code: 'MMMM2222', type_ressource: 'les_deux', critere_ids: [], chapitre_ids: [], amenagement_ids: [] };
  const ancien = { ...base, id: 'A', nom: 'Vieux jeu', code: 'AAAA2222' };
  const tous = [livre, site, mixte, ancien];
  const ids = (f) => filtrerObjets(tous, f, ctx).map((o) => o.id);

  it('cherche dans auteur, éditeur, description et textes « Autre »', () => {
    expect(ids({ q: 'dehaene' })).toEqual(['L']);
    expect(ids({ q: 'odile jacob' })).toEqual(['L']);
    expect(ids({ q: 'exercices en ligne' })).toEqual(['S']);
    expect(ids({ q: 'allophones' })).toEqual(['S']);
  });
  it('cherche un ISBN sans tenir compte des tirets ni des espaces', () => {
    expect(ids({ q: '978-2-7381 19742' })).toEqual(['L']);
  });
  it('filtre par type : « les deux » compte dans les deux', () => {
    expect(ids({ type: 'numerique' })).toEqual(['S', 'M']);
    expect(ids({ type: 'physique' })).toEqual(['L', 'M', 'A']);
  });
  it('traite un objet sans type_ressource comme physique', () => {
    expect(ids({ type: 'numerique' })).not.toContain('A');
    expect(ids({ type: 'physique' })).toContain('A');
  });
  it('combine en OU dans une famille', () => {
    expect(ids({ critereIds: ['k-dys', 'k-tdah'] })).toEqual(['L', 'S']);
  });
  it('combine en ET entre familles', () => {
    expect(ids({ critereIds: ['k-dys', 'k-lec'] })).toEqual(['L']);
    expect(ids({ critereIds: ['k-tdah', 'k-lec'] })).toEqual([]);
  });
  it('un filtre de critère ne plante pas sur un objet sans liens', () => {
    expect(ids({ critereIds: ['k-dys'] })).not.toContain('A');
  });
  it('un chapitre trouve aussi les objets liés à un détail de ce chapitre', () => {
    expect(ids({ chapitreIds: ['ch1'] })).toEqual(['L']);
    expect(ids({ chapitreIds: ['ch2'] })).toEqual(['S']);
  });
  it('un détail trouve aussi les objets liés à son chapitre entier', () => {
    expect(ids({ amenagementIds: ['a9'] })).toEqual(['S']);
    expect(ids({ amenagementIds: ['a1'] })).toEqual(['L']);
  });
  it('chapitres et détails se combinent en OU', () => {
    expect(ids({ chapitreIds: ['ch2'], amenagementIds: ['a1'] })).toEqual(['L', 'S']);
  });
  it('fonctionne sans contexte', () => {
    expect(filtrerObjets(tous, { chapitreIds: ['ch2'] }).map((o) => o.id)).toEqual(['S']);
  });
});
