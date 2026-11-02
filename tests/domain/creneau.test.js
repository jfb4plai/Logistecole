import { describe, it, expect } from 'vitest';
import { validerCreneau, bornesCreneau } from '../../src/domain/creneau.js';

const now = new Date('2026-11-05T09:00:00');

describe('validerCreneau', () => {
  it('accepte un créneau futur et renvoie des instants ISO', () => {
    const r = validerCreneau({ debut: '2026-11-06T10:00', fin: '2026-11-06T12:00' }, now);
    expect(r.ok).toBe(true);
    expect(new Date(r.debut).getTime()).toBe(new Date('2026-11-06T10:00').getTime());
    expect(new Date(r.fin).getTime()).toBe(new Date('2026-11-06T12:00').getTime());
  });
  it('refuse une fin avant ou égale au début', () => {
    expect(validerCreneau({ debut: '2026-11-06T12:00', fin: '2026-11-06T10:00' }, now).ok).toBe(false);
    expect(validerCreneau({ debut: '2026-11-06T12:00', fin: '2026-11-06T12:00' }, now).ok).toBe(false);
  });
  it('refuse un début déjà passé de plus d\'une heure', () => {
    expect(validerCreneau({ debut: '2026-11-05T07:00', fin: '2026-11-05T08:00' }, now).ok).toBe(false);
    expect(validerCreneau({ debut: '2026-11-05T08:30', fin: '2026-11-05T10:00' }, now).ok).toBe(true);
  });
  it('refuse plus de 30 jours et les saisies vides ou illisibles', () => {
    expect(validerCreneau({ debut: '2026-11-06T10:00', fin: '2026-12-20T10:00' }, now).ok).toBe(false);
    expect(validerCreneau({ debut: '', fin: '2026-11-06T10:00' }, now).ok).toBe(false);
    expect(validerCreneau({ debut: 'n\'importe quoi', fin: '2026-11-06T10:00' }, now).ok).toBe(false);
  });
  it('donne un message lisible', () => {
    expect(validerCreneau({ debut: '2026-11-06T12:00', fin: '2026-11-06T10:00' }, now).erreur).toMatch(/fin/i);
  });
});

describe('bornesCreneau (sans borne, le champ année accepte 6 chiffres et décale l’heure saisie)', () => {
  it('donne un minimum à la minute près (heure locale) et un maximum à 4 chiffres d’année', () => {
    expect(bornesCreneau(new Date('2026-11-02T20:07:45'))).toEqual({ min: '2026-11-02T20:07', max: '2099-12-31T23:59' });
  });
  it('complète les zéros (janvier, minuit)', () => {
    expect(bornesCreneau(new Date('2027-01-05T00:03:00')).min).toBe('2027-01-05T00:03');
  });
});
