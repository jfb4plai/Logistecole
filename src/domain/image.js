export const TAILLE_CIBLE = 200 * 1024; // objectif après compression
export const TAILLE_MAX_ORIGINE = 15 * 1024 * 1024; // refus avant même de compresser

export function calculerDimensions(largeur, hauteur, max = 1280) {
  const plusGrand = Math.max(largeur, hauteur);
  if (plusGrand <= max) return { largeur, hauteur };
  const f = max / plusGrand;
  return { largeur: Math.round(largeur * f), hauteur: Math.round(hauteur * f) };
}

export function validerFichierPhoto(file) {
  if (!file || !file.size) return { ok: false, erreur: 'Aucun fichier choisi.' };
  if (!String(file.type).startsWith('image/')) {
    return { ok: false, erreur: 'Le fichier doit être une image (photo ou capture d\'écran).' };
  }
  if (file.size > TAILLE_MAX_ORIGINE) {
    return { ok: false, erreur: 'Cette image est trop lourde (15 Mo au maximum). Prenez-la en plus petit.' };
  }
  return { ok: true };
}

async function versBlob(bitmap, max, qualite) {
  const { largeur, hauteur } = calculerDimensions(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', qualite));
}

// Navigateur uniquement : JPEG ≤ ~200 Ko, côté le plus long ≤ 1280 px.
export async function compresserImage(file) {
  const bitmap = await createImageBitmap(file);
  let max = 1280;
  let blob;
  for (let essai = 0; essai < 4; essai++) {
    for (const q of [0.7, 0.55, 0.4]) {
      blob = await versBlob(bitmap, max, q);
      if (blob.size <= TAILLE_CIBLE) return blob;
    }
    max = Math.round(max * 0.75);
  }
  return blob;
}
