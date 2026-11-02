import { describe, it, expect } from 'vitest';
import { extraireAdresses } from '../../src/domain/adresses.js';

describe('extraireAdresses', () => {
  it('lit une adresse par ligne, ou séparées par virgules, points-virgules, espaces', () => {
    expect(extraireAdresses('a@b.be\nc@d.be')).toEqual(['a@b.be', 'c@d.be']);
    expect(extraireAdresses('a@b.be, c@d.be; e@f.be  g@h.be')).toEqual(['a@b.be', 'c@d.be', 'e@f.be', 'g@h.be']);
  });
  it('ignore les vides et les espaces autour, accepte une colonne copiée d\'Excel (CRLF)', () => {
    expect(extraireAdresses('  a@b.be \r\n\r\n c@d.be \r\n')).toEqual(['a@b.be', 'c@d.be']);
    expect(extraireAdresses('')).toEqual([]);
  });
});
