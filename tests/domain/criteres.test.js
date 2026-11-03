import { describe, it, expect } from 'vitest';
import {
  TYPES_RESSOURCE, MENTION_INDICATIVE, autresVides, autresDepuisObjet, validerAutres,
} from '../../src/domain/criteres.js';

const coche = (texte) => ({ coche: true, texte });
const autres = (o = {}) => ({ ...autresVides(), ...o });

describe('validerAutres', () => {
  it('ne garde rien quand la case est décochée, même si du texte est resté', () => {
    const r = validerAutres(autres({ trouble: { coche: false, texte: 'reste' } }));
    expect(r).toEqual({ ok: true, valeurs: { autre_trouble: null, autre_difficulte: null, autre_amenagement: null } });
  });
  it('refuse une case cochée sans texte, en nommant la famille', () => {
    const r = validerAutres(autres({ difficulte: coche('   ') }));
    expect(r.ok).toBe(false);
    expect(r.erreurs[0]).toContain('Difficultés d\'apprentissage');
  });
  it('nomme les trois familles', () => {
    const r = validerAutres({ trouble: coche(''), difficulte: coche(''), amenagement: coche('') });
    expect(r.erreurs).toHaveLength(3);
    expect(r.erreurs[0]).toContain('Troubles');
    expect(r.erreurs[2]).toContain('Aménagements');
  });
  it('refuse plus de 500 caractères', () => {
    const r = validerAutres(autres({ amenagement: coche('x'.repeat(501)) }));
    expect(r.ok).toBe(false);
    expect(r.erreurs[0]).toContain('500');
  });
  it('rogne le texte accepté', () => {
    const r = validerAutres(autres({ trouble: coche('  élèves allophones ') }));
    expect(r.valeurs.autre_trouble).toBe('élèves allophones');
  });
});

describe('autresDepuisObjet', () => {
  it('coche une famille dont le texte est non vide', () => {
    const a = autresDepuisObjet({ autre_trouble: 'x', autre_difficulte: null });
    expect(a.trouble).toEqual({ coche: true, texte: 'x' });
    expect(a.difficulte).toEqual({ coche: false, texte: '' });
    expect(a.amenagement).toEqual({ coche: false, texte: '' });
  });
});

describe('constantes', () => {
  it('liste les trois types de ressource', () => {
    expect(TYPES_RESSOURCE.map((t) => t.value)).toEqual(['physique', 'numerique', 'les_deux']);
  });
  it('porte la mention indicative exacte', () => {
    expect(MENTION_INDICATIVE).toBe('Étiquettes indicatives posées par l\'équipe, pas une prescription.');
  });
});
