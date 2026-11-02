import { describe, it, expect } from 'vitest';
import { cheminsEmplacements, cheminDe } from '../../src/domain/emplacements.js';

const emps = [
  { id: 'a2', nom: 'Armoire A', parent_id: 'b' },
  { id: 'a1', nom: 'Armoire A', parent_id: 'a' },
  { id: 'a', nom: 'Salle 12', parent_id: null },
  { id: 'b', nom: 'Préau', parent_id: null },
];

describe('cheminsEmplacements', () => {
  it('écrit le chemin complet, pour distinguer deux « Armoire A » dans deux salles', () => {
    const r = cheminsEmplacements(emps);
    expect(r.map((e) => e.chemin)).toEqual(['Préau', 'Préau › Armoire A', 'Salle 12', 'Salle 12 › Armoire A']);
    expect(r.find((e) => e.id === 'a1').chemin).toBe('Salle 12 › Armoire A');
    expect(r.find((e) => e.id === 'a2').chemin).toBe('Préau › Armoire A');
  });
  it('ne plante pas sur un parent absent ni sur une boucle', () => {
    const r = cheminsEmplacements([{ id: 'x', nom: 'Orphelin', parent_id: 'inconnu' }, { id: 'p', nom: 'P', parent_id: 'q' }, { id: 'q', nom: 'Q', parent_id: 'p' }]);
    expect(r.find((e) => e.id === 'x').chemin).toBe('Orphelin');
    expect(r).toHaveLength(3);
  });
  it('liste vide ou absente', () => {
    expect(cheminsEmplacements([])).toEqual([]);
    expect(cheminsEmplacements(undefined)).toEqual([]);
  });
});

describe('cheminDe', () => {
  it('retrouve le chemin d\'un emplacement, ou null', () => {
    expect(cheminDe(emps, 'a1')).toBe('Salle 12 › Armoire A');
    expect(cheminDe(emps, null)).toBeNull();
    expect(cheminDe(emps, 'zzz')).toBeNull();
  });
});
