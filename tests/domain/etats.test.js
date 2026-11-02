import { describe, it, expect } from 'vitest';
import { ETATS, ETATS_RETOUR, ETATS_PRETABLES, libelleEtat, etatsRetourPossibles } from '../../src/domain/etats.js';
import { disponibilite, verifierPretPossible } from '../../src/domain/kit.js';
import { actionsFiche } from '../../src/domain/actions.js';

describe('état « Neuf »', () => {
  it('existe, en premier, avec son libellé', () => {
    expect(ETATS[0]).toMatchObject({ value: 'neuf', label: 'Neuf' });
    expect(libelleEtat('neuf')).toBe('Neuf');
  });
  it('un objet neuf est prêtable, comme un objet en bon état ou usé', () => {
    expect(ETATS_PRETABLES).toEqual(['neuf', 'bon', 'use']);
    expect(disponibilite({ id: 'x', etat: 'neuf' }, [])).toBe('disponible');
    expect(verifierPretPossible({ id: 'x', etat: 'neuf', consommable: false, parent_id: null }, [], []).ok).toBe(true);
  });
  it('un objet neuf peut être emprunté et réservé', () => {
    const a = actionsFiche({ objet: { id: 'x', etat: 'neuf', parent_id: null, consommable: false }, role: 'emprunteur', prets: [], estMonPret: false });
    expect(a).toMatchObject({ emprunter: true, reserver: true, signaler: true });
  });
  it('au retour on ne déclare jamais « sorti » (c’est le rebut), mais « neuf » est possible pour un objet neuf', () => {
    expect(ETATS_RETOUR.map((e) => e.value)).toEqual(['neuf', 'bon', 'use', 'defectueux', 'perdu']);
  });
});

describe('etatsRetourPossibles : un objet ne s’améliore pas au retour', () => {
  const valeurs = (etat) => etatsRetourPossibles(etat).map((e) => e.value);
  it('un objet neuf peut revenir dans tous les états', () => {
    expect(valeurs('neuf')).toEqual(['neuf', 'bon', 'use', 'defectueux', 'perdu']);
  });
  it('un objet en bon état ne peut pas revenir neuf', () => {
    expect(valeurs('bon')).toEqual(['bon', 'use', 'defectueux', 'perdu']);
  });
  it('un objet usé ne peut revenir ni neuf ni en bon état', () => {
    expect(valeurs('use')).toEqual(['use', 'defectueux', 'perdu']);
  });
  it('un état inconnu est traité comme « bon »', () => {
    expect(valeurs('???')).toEqual(['bon', 'use', 'defectueux', 'perdu']);
  });
});
