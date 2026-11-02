// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerBase, executerScript } from './harness.js';

describe('prêts, kits, réservations, stock, pannes : SQL sur Postgres local', () => {
  it('rejoue toutes les migrations puis les tests de la suite', async () => {
    const db = await creerBase();
    const verdict = await executerScript(db, 'supabase/tests/logistecole_prets.sql');
    expect(verdict).toBe('LOGISTECOLE PRETS : tous les tests passent');
  }, 120000);

  it('les tests du socle passent toujours après la migration de la suite', async () => {
    const db = await creerBase();
    const verdict = await executerScript(db, 'supabase/tests/logistecole_rls.sql');
    expect(verdict).toBe('LOGISTECOLE RLS : tous les tests passent');
  }, 120000);
});
