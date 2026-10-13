import { describe, it, expect } from 'vitest';
import {
  ALPHABET, genererCode, genererCodes, formaterCode, normaliserCode, extraireCodeDepuisTexte,
} from '../../src/domain/codes.js';

describe('genererCode', () => {
  it('produit 8 caractères de l\'alphabet sans ambiguïté', () => {
    for (let i = 0; i < 200; i++) {
      const c = genererCode();
      expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
    expect(ALPHABET).not.toMatch(/[01ILO]/);
  });
});

describe('genererCodes', () => {
  it('produit n codes tous distincts', () => {
    const codes = genererCodes(100);
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(100);
  });
  it('évite les codes déjà pris', () => {
    const deja = new Set(['AAAA2222']);
    const codes = genererCodes(50, deja);
    expect(codes).not.toContain('AAAA2222');
  });
});

describe('formaterCode / normaliserCode', () => {
  it('formate avec un tiret', () => {
    expect(formaterCode('ABCD2345')).toBe('ABCD-2345');
  });
  it('normalise minuscules, tirets et espaces', () => {
    expect(normaliserCode(' abcd-2345 ')).toBe('ABCD2345');
  });
  it('refuse un code trop court, trop long ou avec 0/O/1/I/L', () => {
    expect(normaliserCode('ABCD23')).toBeNull();
    expect(normaliserCode('ABCD234567')).toBeNull();
    expect(normaliserCode('ABCD234O')).toBeNull();
    expect(normaliserCode('ABCD2340')).toBeNull();
    expect(normaliserCode('')).toBeNull();
    expect(normaliserCode(null)).toBeNull();
  });
});

describe('extraireCodeDepuisTexte (revue focus 1)', () => {
  it('lit le code dans l\'adresse d\'une étiquette, quel que soit l\'hôte', () => {
    expect(extraireCodeDepuisTexte('https://logistecole.jfb4plai.com/o/ABCD2345')).toBe('ABCD2345');
    expect(extraireCodeDepuisTexte('http://localhost:5173/o/abcd-2345/')).toBe('ABCD2345');
  });
  it('accepte le code saisi à la main', () => {
    expect(extraireCodeDepuisTexte('abcd 2345')).toBe('ABCD2345');
  });
  it('refuse tout ce qui n\'est pas une étiquette Logistécole', () => {
    expect(extraireCodeDepuisTexte('https://exemple.be/produit/12')).toBeNull();
    expect(extraireCodeDepuisTexte('https://logistecole.jfb4plai.com/o/ABC')).toBeNull();
    expect(extraireCodeDepuisTexte('Bonjour')).toBeNull();
    expect(extraireCodeDepuisTexte('')).toBeNull();
    expect(extraireCodeDepuisTexte(undefined)).toBeNull();
  });
});
