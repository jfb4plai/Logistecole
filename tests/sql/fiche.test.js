// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerBase, executerScript } from './harness.js';

describe('fiche enrichie SQL (migration + tests) sur un vrai Postgres local', () => {
  it('rejoue toutes les migrations puis les tests de la fiche', async () => {
    const db = await creerBase();
    const verdict = await executerScript(db, 'supabase/tests/logistecole_fiche.sql');
    expect(verdict).toBe('LOGISTECOLE FICHE : tous les tests passent');
  }, 120000);
});
