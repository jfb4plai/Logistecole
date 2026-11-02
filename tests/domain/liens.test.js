import { describe, it, expect } from 'vitest';
import { analyserLiens, formaterLiens } from '../../src/domain/liens.js';

describe('analyserLiens', () => {
  it('lit « titre | adresse » et une adresse seule', () => {
    const r = analyserLiens('Mode d\'emploi | https://exemple.be/notice.pdf\nhttps://www.youtube.com/watch?v=abc');
    expect(r.erreurs).toEqual([]);
    expect(r.liens).toEqual([
      { titre: 'Mode d\'emploi', url: 'https://exemple.be/notice.pdf' },
      { titre: 'www.youtube.com', url: 'https://www.youtube.com/watch?v=abc' },
    ]);
  });
  it('complète une adresse sans https', () => {
    expect(analyserLiens('exemple.be/notice').liens[0].url).toBe('https://exemple.be/notice');
  });
  it('refuse les adresses dangereuses ou invalides', () => {
    for (const mauvais of ['javascript:alert(1)', 'Piège | data:text/html,<script>', 'ftp://exemple.be', 'pas une adresse', 'vbscript:x']) {
      const r = analyserLiens(mauvais);
      expect(r.liens).toEqual([]);
      expect(r.erreurs).toHaveLength(1);
    }
  });
  it('ignore les lignes vides et limite à 10 liens', () => {
    const texte = Array.from({ length: 12 }, (_, i) => `https://exemple.be/${i}`).join('\n\n');
    const r = analyserLiens(texte);
    expect(r.liens).toHaveLength(10);
    expect(r.erreurs[0]).toMatch(/10/);
  });
  it('tronque un titre trop long', () => {
    const r = analyserLiens(`${'x'.repeat(300)} | https://exemple.be`);
    expect(r.liens[0].titre.length).toBeLessThanOrEqual(120);
  });
});

describe('formaterLiens', () => {
  it('refait le texte éditable', () => {
    const liens = [{ titre: 'Notice', url: 'https://exemple.be/n' }];
    expect(formaterLiens(liens)).toBe('Notice | https://exemple.be/n');
    expect(analyserLiens(formaterLiens(liens)).liens).toEqual(liens);
    expect(formaterLiens(undefined)).toBe('');
  });
});
