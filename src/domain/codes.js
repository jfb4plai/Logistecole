// Alphabet sans 0/O/1/I/L : lisible à l'œil et à la main sur une étiquette.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 8;

const VALIDE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export function genererCode() {
  let out = '';
  while (out.length < LONGUEUR_CODE) {
    const octets = new Uint8Array(LONGUEUR_CODE * 2);
    globalThis.crypto.getRandomValues(octets);
    for (const b of octets) {
      // 248 = 31 * 8 : on écarte le reste pour éviter un biais modulo
      if (b < 248 && out.length < LONGUEUR_CODE) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export function genererCodes(n, deja = new Set()) {
  const pris = new Set(deja);
  const codes = [];
  while (codes.length < n) {
    const c = genererCode();
    if (!pris.has(c)) {
      pris.add(c);
      codes.push(c);
    }
  }
  return codes;
}

export function formaterCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normaliserCode(saisie) {
  if (typeof saisie !== 'string') return null;
  const c = saisie.toUpperCase().replace(/[\s-]/g, '');
  return VALIDE.test(c) ? c : null;
}

// Le QR contient une adresse /o/<code> ; on accepte aussi un code saisi à la main.
export function extraireCodeDepuisTexte(texte) {
  if (typeof texte !== 'string') return null;
  const t = texte.trim();
  const m = t.match(/\/o\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/);
  return normaliserCode(m ? m[1] : t);
}
