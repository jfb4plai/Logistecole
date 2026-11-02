import { describe, it, expect } from 'vitest';
import { validerAchat } from '../../src/domain/achat.js';
import { estSousSeuil } from '../../src/domain/stock.js';

describe('validerAchat', () => {
  it('accepte des champs vides (tout est facultatif)', () => {
    expect(validerAchat({})).toEqual({ ok: true, valeurs: { date_achat: null, fournisseur: null, prix_achat: null, garantie_fin: null, numero_serie: null, facture_url: null, financement: null } });
  });
  it('lit un prix avec virgule, espaces et symbole euro', () => {
    expect(validerAchat({ prix_achat: '1 249,90 €' }).valeurs.prix_achat).toBe(1249.9);
    expect(validerAchat({ prix_achat: '12.5' }).valeurs.prix_achat).toBe(12.5);
  });
  it('refuse un prix négatif ou illisible', () => {
    expect(validerAchat({ prix_achat: '-3' }).ok).toBe(false);
    expect(validerAchat({ prix_achat: 'beaucoup' }).ok).toBe(false);
  });
  it('refuse une garantie qui finit avant l\'achat', () => {
    const r = validerAchat({ date_achat: '2026-09-15', garantie_fin: '2026-01-01' });
    expect(r.ok).toBe(false);
    expect(r.erreurs.join(' ')).toMatch(/garantie/i);
  });
  it('accepte une facture en lien http(s) et refuse le reste', () => {
    expect(validerAchat({ facture_url: 'https://exemple.be/facture.pdf' }).ok).toBe(true);
    expect(validerAchat({ facture_url: 'javascript:alert(1)' }).ok).toBe(false);
  });
  it('nettoie les espaces et transforme les vides en null', () => {
    const r = validerAchat({ fournisseur: '  Fournisseur X  ', numero_serie: '   ' });
    expect(r.valeurs.fournisseur).toBe('Fournisseur X');
    expect(r.valeurs.numero_serie).toBeNull();
  });
});

describe('estSousSeuil', () => {
  it('signale un consommable à ou sous son seuil', () => {
    expect(estSousSeuil({ consommable: true, quantite: 5, seuil_min: 5 })).toBe(true);
    expect(estSousSeuil({ consommable: true, quantite: 2, seuil_min: 5 })).toBe(true);
    expect(estSousSeuil({ consommable: true, quantite: 6, seuil_min: 5 })).toBe(false);
  });
  it('ignore un objet non consommable ou sans seuil', () => {
    expect(estSousSeuil({ consommable: false, quantite: 0, seuil_min: 5 })).toBe(false);
    expect(estSousSeuil({ consommable: true, quantite: 0, seuil_min: null })).toBe(false);
  });
});
