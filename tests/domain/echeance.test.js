import { describe, it, expect } from 'vitest';
import { dateIso, echeanceParDefaut, statutPret, dateLongue } from '../../src/domain/echeance.js';

const jour = (iso) => new Date(`${iso}T09:30:00`);

describe('dateIso', () => {
  it('donne la date locale AAAA-MM-JJ', () => {
    expect(dateIso(jour('2026-11-05'))).toBe('2026-11-05');
  });
});

describe('echeanceParDefaut', () => {
  it('propose 7 jours plus tard', () => {
    expect(echeanceParDefaut(jour('2026-11-05'))).toBe('2026-11-12');
  });
  it('passe correctement le changement de mois et d\'année', () => {
    expect(echeanceParDefaut(jour('2026-12-28'))).toBe('2027-01-04');
    expect(echeanceParDefaut(jour('2026-11-05'), 30)).toBe('2026-12-05');
  });
});

describe('statutPret', () => {
  const now = jour('2026-11-05');
  it('en retard, avec le nombre de jours', () => {
    const s = statutPret({ echeance: '2026-11-03' }, now);
    expect(s.niveau).toBe('retard');
    expect(s.jours).toBe(-2);
    expect(s.libelle).toBe('En retard de 2 jours');
  });
  it('en retard d\'un jour au singulier', () => {
    expect(statutPret({ echeance: '2026-11-04' }, now).libelle).toBe('En retard de 1 jour');
  });
  it('aujourd\'hui et demain sont signalés comme proches', () => {
    expect(statutPret({ echeance: '2026-11-05' }, now)).toMatchObject({ niveau: 'bientot', libelle: 'À rendre aujourd\'hui' });
    expect(statutPret({ echeance: '2026-11-06' }, now)).toMatchObject({ niveau: 'bientot', libelle: 'À rendre demain' });
  });
  it('plus tard : en cours, avec la date en toutes lettres', () => {
    const s = statutPret({ echeance: '2026-11-12' }, now);
    expect(s.niveau).toBe('ok');
    expect(s.jours).toBe(7);
    expect(s.libelle).toMatch(/^À rendre le jeudi 12 novembre/);
  });
  it('ignore l\'heure de la journée', () => {
    const tard = new Date('2026-11-05T23:59:00');
    expect(statutPret({ echeance: '2026-11-05' }, tard).niveau).toBe('bientot');
  });
});

describe('dateLongue', () => {
  it('écrit la date en français, avec le jour de la semaine', () => {
    expect(dateLongue('2026-11-09')).toBe('lundi 9 novembre');
    expect(dateLongue('2026-11-12')).toBe('jeudi 12 novembre');
  });
});
