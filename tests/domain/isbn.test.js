import { describe, it, expect } from 'vitest';
import { normaliserIsbn } from '../../src/domain/isbn.js';

describe('normaliserIsbn', () => {
  it('convertit un ISBN-10 avec tirets en ISBN-13', () => {
    expect(normaliserIsbn('2-7381-1974-3')).toBe('9782738119742');
    expect(normaliserIsbn('2808113064')).toBe('9782808113069');
  });
  it('accepte un ISBN-13 avec espaces', () => {
    expect(normaliserIsbn('978 2 8081 1306 9')).toBe('9782808113069');
  });
  it('accepte un ISBN-10 terminé par x ou X', () => {
    expect(normaliserIsbn('080442957X')).toBe('9780804429573');
    expect(normaliserIsbn('080442957x')).toBe('9780804429573');
  });
  it('refuse une mauvaise clé, une mauvaise longueur ou du texte', () => {
    expect(normaliserIsbn('9782738119743')).toBeNull();
    expect(normaliserIsbn('2738119742')).toBeNull();
    expect(normaliserIsbn('12345')).toBeNull();
    expect(normaliserIsbn('')).toBeNull();
    expect(normaliserIsbn(null)).toBeNull();
    expect(normaliserIsbn('abcdefghij')).toBeNull();
  });
});
