import { describe, it, expect } from 'vitest';
import { lireErreurLien } from '../../src/domain/authurl.js';

describe('lireErreurLien', () => {
  it('explique un lien expiré ou déjà utilisé (certaines messageries l\'ouvrent avant vous)', () => {
    const r = lireErreurLien('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(r.code).toBe('otp_expired');
    expect(r.message).toMatch(/expiré|déjà utilisé/);
    expect(r.message).toMatch(/nouveau/);
  });
  it('donne un message générique pour toute autre erreur de lien', () => {
    const r = lireErreurLien('#error=server_error&error_code=unexpected_failure&error_description=boom');
    expect(r.code).toBe('unexpected_failure');
    expect(r.message).toMatch(/lien/);
    expect(r.message).not.toMatch(/boom/);
  });
  it('lit aussi l\'erreur placée dans la requête (flux PKCE)', () => {
    expect(lireErreurLien('?error=access_denied&error_code=otp_expired').code).toBe('otp_expired');
  });
  it('ne signale rien quand il n\'y a pas d\'erreur, y compris avec des jetons de connexion', () => {
    expect(lireErreurLien('')).toBeNull();
    expect(lireErreurLien('#access_token=abc&refresh_token=def&type=magiclink')).toBeNull();
    expect(lireErreurLien(undefined)).toBeNull();
  });
});
