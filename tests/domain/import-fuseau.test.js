// Fuseau forcé avant tout calcul de date : read-excel-file renvoie les dates en minuit UTC.
process.env.TZ = 'America/Toronto';
import { describe, it, expect } from 'vitest';
import { analyserImport } from '../../src/domain/import.js';

const categories = [{ id: 'c1', nom: 'Matériel de sciences' }];

describe('dates Excel dans un fuseau à l\'ouest de Greenwich', () => {
  it('garde le bon jour pour une date en minuit UTC', () => {
    const r = analyserImport([['nom', 'catégorie', 'date d\'achat'], ['Loupe', 'Matériel de sciences', new Date('2026-09-15T00:00:00Z')]], { categories });
    expect(r.erreurs).toEqual([]);
    expect(r.objets[0].date_achat).toBe('2026-09-15');
  });
  it('garde aussi le bon jour pour une date locale à minuit', () => {
    const r = analyserImport([['nom', 'catégorie', 'date d\'achat'], ['Loupe', 'Matériel de sciences', new Date(2026, 8, 15, 0, 0, 0)]], { categories });
    expect(r.objets[0].date_achat).toBe('2026-09-15');
  });
});
