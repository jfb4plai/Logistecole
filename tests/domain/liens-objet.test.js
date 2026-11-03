import { describe, it, expect } from 'vitest';
import { normaliserLiens } from '../../src/domain/liensObjet.js';

describe('normaliserLiens', () => {
  it('extrait les identifiants des critères, chapitres et aménagements', () => {
    const o = normaliserLiens({
      id: 'o1',
      logi_objets_criteres: [{ critere_id: 'k1' }],
      logi_objets_amenagements: [{ chapitre_id: 'c1', amenagement_id: null }, { chapitre_id: null, amenagement_id: 'a1' }],
    });
    expect(o.critere_ids).toEqual(['k1']);
    expect(o.chapitre_ids).toEqual(['c1']);
    expect(o.amenagement_ids).toEqual(['a1']);
    expect(o.id).toBe('o1');
  });
  it('donne des tableaux vides quand les liens sont absents ou nuls', () => {
    for (const o of [normaliserLiens({}), normaliserLiens({ logi_objets_criteres: null, logi_objets_amenagements: null })]) {
      expect(o.critere_ids).toEqual([]);
      expect(o.chapitre_ids).toEqual([]);
      expect(o.amenagement_ids).toEqual([]);
    }
  });
});
