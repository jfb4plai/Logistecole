import { describe, it, expect } from 'vitest';
import { ETATS, ETATS_RETOUR, ETATS_PRETABLES, libelleEtat } from '../../src/domain/etats.js';
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
  it('au retour on ne déclare jamais « neuf » ni « sorti »', () => {
    expect(ETATS_RETOUR.map((e) => e.value)).toEqual(['bon', 'use', 'defectueux', 'perdu']);
  });
});
