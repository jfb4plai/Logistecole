import { formaterCode } from './codes.js';

export function calculerPlanche({ colonnes = 3, lignes = 8, largeur = 210, hauteur = 297, marge = 10 } = {}) {
  const w = (largeur - 2 * marge) / colonnes;
  const h = (hauteur - 2 * marge) / lignes;
  const cellules = [];
  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < colonnes; c++) cellules.push({ x: marge + c * w, y: marge + l * h, w, h });
  }
  return cellules;
}

export function tronquerTexte(texte, max) {
  const s = String(texte ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`;
}

// Les polices PDF standard ne dessinent que le Latin-1 : le reste devient « ? ».
export function nettoyerPourPdf(texte) {
  return Array.from(String(texte ?? ''), (ch) => {
    const n = ch.codePointAt(0);
    return n >= 32 && n <= 255 && !(n >= 127 && n <= 159) ? ch : '?';
  }).join('');
}

export async function genererPdfEtiquettes(objets, orgNom, baseUrl) {
  const [{ jsPDF }, qrModule] = await Promise.all([import('jspdf'), import('qrcode')]);
  const QRCode = qrModule.default ?? qrModule;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cellules = calculerPlanche();

  for (let i = 0; i < objets.length; i++) {
    if (i > 0 && i % cellules.length === 0) doc.addPage();
    const { x, y, w, h } = cellules[i % cellules.length];
    const o = objets[i];

    doc.setDrawColor(200);
    doc.rect(x, y, w, h);

    const qr = await QRCode.toDataURL(`${baseUrl}/o/${o.code}`, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
    const taille = 26;
    doc.addImage(qr, 'PNG', x + 2, y + (h - taille) / 2, taille, taille);

    const tx = x + taille + 5;
    const largeurTexte = w - taille - 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(nettoyerPourPdf(tronquerTexte(o.nom, 48)), largeurTexte).slice(0, 3), tx, y + 8);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(formaterCode(o.code), tx, y + h - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(doc.splitTextToSize(nettoyerPourPdf(tronquerTexte(orgNom, 40)), largeurTexte).slice(0, 2), tx, y + h - 6);
  }
  return doc;
}
