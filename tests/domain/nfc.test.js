import { describe, it, expect, afterEach } from 'vitest';
import { objetUrl, nfcSupported, nfcVerrouillageSupporte, ecrireEtiquette, extraireUrl, comparerEtiquette } from '../../src/lib/nfc.js';

const enregistrement = (type, texte) => ({ recordType: type, data: new DataView(new TextEncoder().encode(texte).buffer) });

afterEach(() => { delete globalThis.NDEFReader; });

describe('objetUrl', () => {
  it('construit /o/<code> sans double barre', () => {
    expect(objetUrl('ABCD2345', 'https://logistecole.jfb4plai.com/')).toBe('https://logistecole.jfb4plai.com/o/ABCD2345');
    expect(objetUrl('ABCD2345', 'http://localhost:5180')).toBe('http://localhost:5180/o/ABCD2345');
  });
});

describe('support du navigateur', () => {
  it('NFC absent par défaut (autres navigateurs que Chrome sur Android)', () => {
    expect(nfcSupported()).toBe(false);
    expect(nfcVerrouillageSupporte()).toBe(false);
  });
  it('détecte NDEFReader et la fonction de verrouillage', () => {
    globalThis.NDEFReader = class { async write() {} };
    expect(nfcSupported()).toBe(true);
    expect(nfcVerrouillageSupporte()).toBe(false);
    globalThis.NDEFReader = class { async write() {} async makeReadOnly() {} };
    expect(nfcVerrouillageSupporte()).toBe(true);
  });
});

describe('ecrireEtiquette', () => {
  it('refuse quand le navigateur ne sait pas écrire', async () => {
    await expect(ecrireEtiquette('https://x.be/o/ABCD2345')).rejects.toThrow('NFC_UNSUPPORTED');
  });
  it('écrit un seul enregistrement de type url, rien d\'autre', async () => {
    const appels = [];
    globalThis.NDEFReader = class { async write(m) { appels.push(['write', m]); } async makeReadOnly() { appels.push(['lock']); } };
    await ecrireEtiquette('https://x.be/o/ABCD2345');
    expect(appels).toEqual([['write', { records: [{ recordType: 'url', data: 'https://x.be/o/ABCD2345' }] }]]);
  });
  it('verrouille seulement sur demande et seulement si c\'est possible', async () => {
    const appels = [];
    globalThis.NDEFReader = class { async write() { appels.push('write'); } async makeReadOnly() { appels.push('lock'); } };
    await ecrireEtiquette('https://x.be/o/ABCD2345', { verrouiller: true });
    expect(appels).toEqual(['write', 'lock']);
    globalThis.NDEFReader = class { async write() {} };
    await expect(ecrireEtiquette('https://x.be/o/ABCD2345', { verrouiller: true })).rejects.toThrow('LOCK_UNSUPPORTED');
  });
});

describe('lecture d\'une étiquette', () => {
  it('extraireUrl prend le premier enregistrement url', () => {
    expect(extraireUrl([enregistrement('text', 'bonjour'), enregistrement('url', 'https://x.be/o/ABCD2345')])).toBe('https://x.be/o/ABCD2345');
    expect(extraireUrl([enregistrement('text', 'bonjour')])).toBeNull();
    expect(extraireUrl(undefined)).toBeNull();
  });
  it('comparerEtiquette dit si la puce correspond à l\'objet attendu', () => {
    expect(comparerEtiquette(null, 'ABCD2345')).toEqual({ statut: 'vide' });
    expect(comparerEtiquette('https://x.be/o/ABCD2345', 'ABCD2345')).toEqual({ statut: 'identique' });
    expect(comparerEtiquette('https://x.be/o/abcd-2345', 'ABCD2345')).toEqual({ statut: 'identique' });
    expect(comparerEtiquette('https://x.be/o/WXYZ2345', 'ABCD2345')).toEqual({ statut: 'autre', codeTrouve: 'WXYZ2345' });
    expect(comparerEtiquette('https://exemple.be/menu', 'ABCD2345')).toEqual({ statut: 'etrangere' });
  });
});
