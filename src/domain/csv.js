// Lecture d'un CSV tel qu'Excel l'écrit en français : séparateur « ; », guillemets, BOM.
export function lireCsv(entree) {
  const t = String(entree ?? '').replace(/^﻿/, '');
  const premiere = t.split(/\r?\n/)[0] ?? '';
  const sep = [';', '\t', ','].map((s) => [s, premiere.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const lignes = [];
  let ligne = [];
  let cellule = '';
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(cellule); cellule = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      ligne.push(cellule); cellule = '';
      lignes.push(ligne); ligne = [];
    } else cellule += c;
  }
  if (cellule !== '' || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  return lignes.map((l) => l.map((x) => x.trim())).filter((l) => l.some((x) => x !== ''));
}
