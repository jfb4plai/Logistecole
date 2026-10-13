import { describe, it, expect } from 'vitest';
import { calculerDimensions, validerFichierPhoto, TAILLE_MAX_ORIGINE } from '../../src/domain/image.js';

describe('calculerDimensions', () => {
  it('ne grandit jamais une petite image', () => {
    expect(calculerDimensions(800, 600, 1280)).toEqual({ largeur: 800, hauteur: 600 });
  });
  it('réduit en gardant les proportions', () => {
    expect(calculerDimensions(4000, 3000, 1280)).toEqual({ largeur: 1280, hauteur: 960 });
    expect(calculerDimensions(3000, 4000, 1280)).toEqual({ largeur: 960, hauteur: 1280 });
  });
});

describe('validerFichierPhoto (revue focus 4)', () => {
  const f = (type, size) => ({ type, size, name: 'x' });
  it('accepte une image raisonnable', () => {
    expect(validerFichierPhoto(f('image/jpeg', 3_000_000)).ok).toBe(true);
    expect(validerFichierPhoto(f('image/png', 100)).ok).toBe(true);
  });
  it('refuse un PDF, un fichier vide, ou une image trop lourde', () => {
    expect(validerFichierPhoto(f('application/pdf', 1000)).ok).toBe(false);
    expect(validerFichierPhoto(f('image/jpeg', 0)).ok).toBe(false);
    expect(validerFichierPhoto(f('image/jpeg', TAILLE_MAX_ORIGINE + 1)).ok).toBe(false);
    expect(validerFichierPhoto(null).ok).toBe(false);
  });
  it('explique le refus', () => {
    expect(validerFichierPhoto(f('application/pdf', 1000)).erreur).toMatch(/image/i);
  });
});
