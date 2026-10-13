import { describe, it, expect } from 'vitest';
import { messageErreur } from '../../src/lib/erreurs.js';

describe('messageErreur', () => {
  it('traduit les erreurs de base de données courantes', () => {
    expect(messageErreur({ code: '23505' })).toMatch(/existe déjà/);
    expect(messageErreur({ code: '23503' })).toMatch(/encore utilisé/);
    expect(messageErreur({ code: '42501' })).toMatch(/pas le droit/);
  });
  it('traduit session expirée, réseau et limites', () => {
    expect(messageErreur({ message: 'JWT expired' })).toMatch(/session/i);
    expect(messageErreur(new TypeError('Failed to fetch'))).toMatch(/Connexion impossible/);
    expect(messageErreur({ status: 429 })).toMatch(/Patientez/);
  });
  it('laisse passer les messages français de nos propres règles', () => {
    expect(messageErreur({ code: 'P0001', message: 'Entre 1 et 100 objets par opération' })).toBe('Entre 1 et 100 objets par opération');
  });
  it('ne montre jamais de détail technique pour une erreur inconnue', () => {
    const m = messageErreur({ code: 'XX999', message: 'relation "logi_objets" does not exist' });
    expect(m).not.toMatch(/relation|logi_/);
    expect(messageErreur(undefined)).toMatch(/erreur/i);
  });
});
