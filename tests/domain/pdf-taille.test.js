// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { genererPdfEtiquettes } from '../../src/domain/etiquettes.js';

const CODES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const objets = (n) => Array.from({ length: n }, (_, i) => ({ nom: `Tablette ${i + 1}`, code: `${CODES[i % 31]}BCD${CODES[(i * 7) % 31]}${CODES[(i * 3) % 31]}2${CODES[(i * 5) % 31]}` }));

describe('taille du PDF d\'étiquettes (revue de terrain : 1 Mo pour 4 étiquettes)', () => {
  it('reste légère : une planche de 24 étiquettes tient en moins de 600 Ko', async () => {
    const doc = await genererPdfEtiquettes(objets(24), 'Pôle PLAI (essai)', 'https://logistecole.jfb4plai.com');
    const octets = doc.output('arraybuffer').byteLength;
    expect(octets).toBeLessThan(600 * 1024);
  }, 60000);
  it('100 étiquettes tiennent en moins de 2,5 Mo', async () => {
    const doc = await genererPdfEtiquettes(objets(100), 'Pôle PLAI (essai)', 'https://logistecole.jfb4plai.com');
    expect(doc.output('arraybuffer').byteLength).toBeLessThan(2.5 * 1024 * 1024);
  }, 120000);
});
