// @vitest-environment node
import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { extraireCodeDepuisTexte } from '../../src/domain/codes.js';

describe('le QR imprimé contient bien l\'adresse de la fiche', () => {
  it('lit le QR généré et retrouve le code de l\'objet', async () => {
    const url = 'https://logistecole.jfb4plai.com/o/ABCD2345';
    const buf = await QRCode.toBuffer(url, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
    const png = PNG.sync.read(buf);
    const lu = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(lu).not.toBeNull();
    expect(lu.data).toBe(url);
    expect(extraireCodeDepuisTexte(lu.data)).toBe('ABCD2345');
  });
});
