import { decoderTexte, lireCsv } from '../domain/csv.js';

export async function lireFichierImport(fichier) {
  if (/\.csv$/i.test(fichier.name) || fichier.type === 'text/csv') return lireCsv(decoderTexte(await fichier.arrayBuffer()));
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(fichier);
}
export const executerImport = async ({ analyse, surProgres }) => {
  const total = analyse.objets.reduce((s, o) => s + o.quantite, 0);
  surProgres?.(total, total);
  return { crees: total };
};
