// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { creerBase, executerScript } from './harness.js';

describe('socle SQL (migration + tests d\'isolation) sur un vrai Postgres local', () => {
  it('rejoue la migration puis tous les tests RLS du socle', async () => {
    const db = await creerBase(['20261013_logistecole_core.sql']);
    const verdict = await executerScript(db, 'supabase/tests/logistecole_rls.sql');
    expect(verdict).toBe('LOGISTECOLE RLS : tous les tests passent');
  }, 60000);
});
