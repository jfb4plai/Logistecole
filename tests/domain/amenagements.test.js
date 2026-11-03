import { describe, it, expect } from 'vitest';
import {
  organiserCatalogue, selectionVide, selectionDepuisObjet, basculerChapitre, basculerAmenagement,
  resumeChapitre, libelleSelection, chapitreDeAmenagement,
} from '../../src/domain/amenagements.js';

const donnees = {
  chapitres: [
    { id: 'c2', ordre: 2, titre: 'Dispositif de régulation', est_dispositif: true },
    { id: 'c1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS', est_dispositif: false },
    { id: 'c3', ordre: 3, titre: '3. VIDE', est_dispositif: false },
  ],
  amenagements: [
    { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Temps supplémentaire', type: 'AR', actif: true },
    { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Police lisible', type: 'AU', actif: true },
    { id: 'a3', chapitre_id: 'c1', ordre: 3, libelle: 'Ancien', type: 'AR', actif: false },
    { id: 'a4', chapitre_id: 'c2', ordre: 1, libelle: 'Contrat', type: 'AR', actif: true },
  ],
};
const cat = organiserCatalogue(donnees);
const c1 = cat.find((c) => c.id === 'c1');
const c2 = cat.find((c) => c.id === 'c2');

describe('organiserCatalogue', () => {
  it('trie chapitres et items par ordre et garde les chapitres vides', () => {
    expect(cat.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(c1.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(cat[2].items).toEqual([]);
  });
  it('étiquette AU / AR, et « Dispositif » malgré le type stocké', () => {
    expect(c1.items.map((i) => i.etiquette)).toEqual(['AU', 'AR']);
    expect(c2.items[0].etiquette).toBe('Dispositif');
    expect(c2.estDispositif).toBe(true);
  });
  it('masque un aménagement désactivé sauf s\'il est déjà choisi', () => {
    expect(c1.items.find((i) => i.id === 'a3')).toBeUndefined();
    const avec = organiserCatalogue(donnees, { dejaChoisis: ['a3'] }).find((c) => c.id === 'c1');
    expect(avec.items.map((i) => i.id)).toEqual(['a1', 'a2', 'a3']);
    expect(avec.items[2].desactive).toBe(true);
    expect(avec.items[0].desactive).toBe(false);
  });
});

describe('sélection', () => {
  it('démarre vide et se lit depuis un objet', () => {
    expect(selectionVide()).toEqual({ chapitres: [], amenagements: [] });
    expect(selectionDepuisObjet({ chapitre_ids: ['c1'], amenagement_ids: ['a4'] })).toEqual({ chapitres: ['c1'], amenagements: ['a4'] });
    expect(selectionDepuisObjet({})).toEqual({ chapitres: [], amenagements: [] });
  });
  it('cocher un chapitre retire ses détails mais garde ceux des autres chapitres', () => {
    const sel = basculerChapitre({ chapitres: [], amenagements: ['a1', 'a4'] }, c1);
    expect(sel).toEqual({ chapitres: ['c1'], amenagements: ['a4'] });
  });
  it('décocher un chapitre le retire sans toucher au reste', () => {
    expect(basculerChapitre({ chapitres: ['c1'], amenagements: ['a4'] }, c1)).toEqual({ chapitres: [], amenagements: ['a4'] });
  });
  it('ne change pas un détail quand le chapitre est entier', () => {
    const sel = { chapitres: ['c1'], amenagements: [] };
    expect(basculerAmenagement(sel, c1, 'a1')).toEqual(sel);
  });
  it('coche et décoche un détail sans modifier l\'argument', () => {
    const sel = Object.freeze({ chapitres: [], amenagements: ['a1'] });
    expect(basculerAmenagement(sel, c1, 'a2').amenagements).toEqual(['a1', 'a2']);
    expect(basculerAmenagement(sel, c1, 'a1').amenagements).toEqual([]);
  });
  it('résume un chapitre', () => {
    expect(resumeChapitre({ chapitres: [], amenagements: ['a1', 'a2'] }, c1)).toEqual({ entier: false, choisis: 2, total: 2 });
    expect(resumeChapitre({ chapitres: ['c1'], amenagements: [] }, c1)).toEqual({ entier: true, choisis: 2, total: 2 });
    expect(resumeChapitre(selectionVide(), c2)).toEqual({ entier: false, choisis: 0, total: 1 });
  });
  it('libelle la sélection', () => {
    expect(libelleSelection(selectionVide())).toBe('Aucun');
    expect(libelleSelection({ chapitres: ['c1'], amenagements: [] })).toBe('1 chapitre');
    expect(libelleSelection({ chapitres: ['c1', 'c2'], amenagements: ['a1', 'a2', 'a4'] })).toBe('2 chapitres, 3 aménagements');
    expect(libelleSelection({ chapitres: [], amenagements: ['a1'] })).toBe('1 aménagement');
  });
  it('associe chaque aménagement à son chapitre', () => {
    const m = chapitreDeAmenagement(cat);
    expect(m.get('a4')).toBe('c2');
    expect(m.get('a1')).toBe('c1');
  });
});
