import { describe, it, expect } from 'vitest';
import { validerLot, MAX_LOT } from '../../src/domain/lot.js';

describe('validerLot (revue focus 2)', () => {
  it('accepte un lot valide et nettoie le nom', () => {
    expect(validerLot({ nom: '  Tablette  ', quantite: '16' })).toEqual({ ok: true, nom: 'Tablette', quantite: 16 });
  });
  it('refuse une quantité hors 1..100, non entière ou vide', () => {
    for (const q of [0, -1, 101, 2.5, '', 'abc', null, undefined, NaN]) {
      expect(validerLot({ nom: 'Tablette', quantite: q }).ok).toBe(false);
    }
    expect(MAX_LOT).toBe(100);
    expect(validerLot({ nom: 'Tablette', quantite: 100 }).ok).toBe(true);
  });
  it('refuse un nom vide ou de plus de 120 caractères', () => {
    expect(validerLot({ nom: '   ', quantite: 1 }).ok).toBe(false);
    expect(validerLot({ nom: 'x'.repeat(121), quantite: 1 }).ok).toBe(false);
    expect(validerLot({ nom: 'x'.repeat(120), quantite: 1 }).ok).toBe(true);
  });
  it('donne un message lisible', () => {
    expect(validerLot({ nom: '', quantite: 1 }).erreur).toMatch(/nom/i);
    expect(validerLot({ nom: 'A', quantite: 101 }).erreur).toMatch(/100/);
  });
});
