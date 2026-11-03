import { describe, it, expect } from 'vitest';
import { MIN_MOT_DE_PASSE, validerMotDePasse, messageConnexionMotDePasse, messageChangementMotDePasse } from '../../src/domain/motdepasse.js';

describe('validerMotDePasse', () => {
  const bon = 'phrase de passe longue';
  it('accepte une phrase de passe d\'au moins 12 caractères, confirmée', () => {
    expect(MIN_MOT_DE_PASSE).toBe(12);
    expect(validerMotDePasse(bon, bon, 'a@ecole.be')).toEqual({ ok: true });
    expect(validerMotDePasse('x'.repeat(12), 'x'.repeat(12), 'a@ecole.be').ok).toBe(true);
  });
  it('refuse un mot de passe trop court, en disant combien il en faut', () => {
    const r = validerMotDePasse('x'.repeat(11), 'x'.repeat(11), 'a@ecole.be');
    expect(r.ok).toBe(false);
    expect(r.erreurs[0]).toContain('12');
  });
  it('refuse une confirmation différente', () => {
    const r = validerMotDePasse(bon, `${bon}!`, 'a@ecole.be');
    expect(r.ok).toBe(false);
    expect(r.erreurs[0]).toMatch(/identiques/);
  });
  it('refuse l\'adresse e-mail comme mot de passe, sans tenir compte de la casse', () => {
    const r = validerMotDePasse('Jean.Dupont@Ecole.be', 'Jean.Dupont@Ecole.be', 'jean.dupont@ecole.be');
    expect(r.ok).toBe(false);
    expect(r.erreurs[0]).toMatch(/adresse e-mail/);
  });
  it('cumule les erreurs', () => {
    expect(validerMotDePasse('court', 'autre', 'a@ecole.be').erreurs).toHaveLength(2);
  });
  it('ne rogne pas les espaces : une phrase de passe peut en contenir', () => {
    expect(validerMotDePasse('  douze espaces', '  douze espaces', 'a@ecole.be').ok).toBe(true);
  });
});

describe('messageConnexionMotDePasse', () => {
  it('ne dit pas si c\'est l\'adresse ou le mot de passe qui est faux, et oriente vers le lien e-mail', () => {
    const m = messageConnexionMotDePasse({ code: 'invalid_credentials', status: 400 });
    expect(m).toMatch(/Adresse ou mot de passe incorrect/);
    expect(m).toMatch(/lien/);
  });
  it('reconnaît le trop grand nombre de tentatives', () => {
    expect(messageConnexionMotDePasse({ status: 429 })).toMatch(/Trop de/);
  });
  it('retombe sur le message générique sans détail technique', () => {
    expect(messageConnexionMotDePasse({ message: 'boom' })).toMatch(/Une erreur est survenue/);
  });
});

describe('messageChangementMotDePasse', () => {
  it('traduit « même mot de passe » et « mot de passe trop faible »', () => {
    expect(messageChangementMotDePasse({ code: 'same_password' })).toMatch(/déjà/);
    expect(messageChangementMotDePasse({ code: 'weak_password' })).toMatch(/trop faible|trop courant/);
  });
  it('demande de se reconnecter quand la session est trop ancienne', () => {
    expect(messageChangementMotDePasse({ code: 'reauthentication_needed' })).toMatch(/lien e-mail/);
  });
  it('retombe sur le message générique', () => {
    expect(messageChangementMotDePasse({ message: 'boom' })).toMatch(/Une erreur est survenue/);
  });
});
