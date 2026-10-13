import { describe, it, expect } from 'vitest';
import { calculerPlanche, tronquerTexte, nettoyerPourPdf } from '../../src/domain/etiquettes.js';

describe('calculerPlanche', () => {
  it('donne 24 cellules qui tiennent dans la page A4 sans se chevaucher', () => {
    const c = calculerPlanche();
    expect(c).toHaveLength(24);
    for (const { x, y, w, h } of c) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(x + w).toBeLessThanOrEqual(200 + 1e-9);
      expect(y + h).toBeLessThanOrEqual(287 + 1e-9);
    }
    expect(c[1].x).toBeCloseTo(c[0].x + c[0].w);
    expect(c[3].y).toBeCloseTo(c[0].y + c[0].h);
  });
});

describe('tronquerTexte / nettoyerPourPdf (revue focus 5)', () => {
  it('tronque un nom très long avec des points de suspension ASCII', () => {
    const t = tronquerTexte('x'.repeat(500), 48);
    expect(t.length).toBeLessThanOrEqual(48);
    expect(t.endsWith('...')).toBe(true);
  });
  it('laisse intact un nom court et normalise les espaces', () => {
    expect(tronquerTexte('  Valise   de tablettes ', 48)).toBe('Valise de tablettes');
  });
  it('conserve les accents français et remplace ce que la police ne sait pas dessiner', () => {
    expect(nettoyerPourPdf('Matériel d\'éveil à l\'écoute')).toBe('Matériel d\'éveil à l\'écoute');
    expect(nettoyerPourPdf('Projecteur 📽 salle 12')).toBe('Projecteur ? salle 12');
    expect(nettoyerPourPdf('Cœur')).toBe('C?ur');
  });
  it('supporte une valeur absente', () => {
    expect(tronquerTexte(undefined, 10)).toBe('');
  });
});
