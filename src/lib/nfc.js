// Étiquettes NFC : même contenu que le QR, l'adresse de la fiche. Écriture : Chrome sur Android, HTTPS.
// Repris du garde-manger (écriture d'un enregistrement url), adapté aux codes d'objet.
import { extraireCodeDepuisTexte } from '../domain/codes.js';

export function objetUrl(code, origine) {
  return `${origine.replace(/\/+$/, '')}/o/${code}`;
}

export function nfcSupported() {
  return typeof globalThis.NDEFReader !== 'undefined';
}

// Le verrouillage rend la puce non réécrivable, de façon définitive. Disponible seulement si le navigateur l'expose.
export function nfcVerrouillageSupporte() {
  return nfcSupported() && typeof globalThis.NDEFReader.prototype?.makeReadOnly === 'function';
}

export async function ecrireEtiquette(url, { verrouiller = false } = {}) {
  if (!nfcSupported()) throw new Error('NFC_UNSUPPORTED');
  if (verrouiller && !nfcVerrouillageSupporte()) throw new Error('LOCK_UNSUPPORTED');
  const lecteur = new globalThis.NDEFReader();
  await lecteur.write({ records: [{ recordType: 'url', data: url }] });
  if (verrouiller) await lecteur.makeReadOnly();
}

// Premier enregistrement de type url d'une puce lue, ou null.
export function extraireUrl(enregistrements) {
  const r = (enregistrements ?? []).find((x) => x.recordType === 'url');
  if (!r?.data) return null;
  try { return new TextDecoder().decode(r.data); } catch { return null; }
}

// Compare ce que dit la puce à l'objet attendu : vide, identique, autre objet, ou étrangère.
export function comparerEtiquette(url, codeAttendu) {
  if (!url) return { statut: 'vide' };
  const trouve = /\/o\/[^/?#]+/.test(url) ? extraireCodeDepuisTexte(url) : null;
  if (!trouve) return { statut: 'etrangere' };
  return trouve === codeAttendu ? { statut: 'identique' } : { statut: 'autre', codeTrouve: trouve };
}

// Lit la puce posée contre le téléphone. Renvoie l'adresse, ou null si la puce est vide.
export function lireEtiquette(delaiMs = 15000) {
  if (!nfcSupported()) return Promise.reject(new Error('NFC_UNSUPPORTED'));
  return new Promise((resolve, reject) => {
    const lecteur = new globalThis.NDEFReader();
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => { ctrl.abort(); reject(new Error('TIMEOUT')); }, delaiMs);
    lecteur.onreading = (e) => { clearTimeout(minuteur); ctrl.abort(); resolve(extraireUrl(e.message?.records)); };
    lecteur.onreadingerror = () => { clearTimeout(minuteur); ctrl.abort(); reject(new Error('UNREADABLE')); };
    lecteur.scan({ signal: ctrl.signal }).catch((err) => { clearTimeout(minuteur); reject(err); });
  });
}
